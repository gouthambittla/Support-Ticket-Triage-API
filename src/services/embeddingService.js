/**
 * Turns text into embedding vectors using a local Ollama model.
 *
 * This is the ONLY file that talks to the embedding API. Swapping to another
 * provider (OpenAI, Gemini, ...) means changing this file and nothing else.
 *
 * The same service instance — and therefore the same model — is used for
 * both indexed tickets and incoming queries.
 */

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "nomic-embed-text";
const REQUEST_TIMEOUT_MS = 60_000;

class EmbeddingError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(message, options) {
    super(message, options);
    this.name = "EmbeddingError";
  }
}

/**
 * @typedef {Object} EmbeddingService
 * @property {string} model
 * @property {(texts: string[]) => Promise<number[][]>} embedMany
 * @property {(text: string) => Promise<number[]>} embed
 */

/**
 * @param {Object} [options]
 * @param {string} [options.baseUrl]  Ollama server URL.
 * @param {string} [options.model]    Embedding model name.
 * @param {typeof fetch} [options.fetchFn]  Injectable for tests.
 * @returns {EmbeddingService}
 */
function createEmbeddingService({
  baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.OLLAMA_EMBEDDING_MODEL || DEFAULT_MODEL,
  fetchFn = fetch,
} = {}) {
  // text -> vector. An unchanged ticket has unchanged text, so it is never
  // sent to the model twice during the life of this process.
  /** @type {Map<string, number[]>} */
  const cache = new Map();

  /**
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async function requestEmbeddings(texts) {
    let response;
    try {
      response = await fetchFn(`${baseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: texts }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new EmbeddingError(
        `Could not reach Ollama at ${baseUrl}. Is it running? (try: ollama serve)`,
        { cause: error }
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new EmbeddingError(
        `Embedding request failed with HTTP ${response.status}: ${body.slice(0, 200)}`
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new EmbeddingError("Embedding response was not valid JSON.", { cause: error });
    }

    return validateEmbeddings(data?.embeddings, texts.length);
  }

  /** @type {EmbeddingService["embedMany"]} */
  async function embedMany(texts) {
    for (const text of texts) {
      if (typeof text !== "string" || text.trim() === "") {
        throw new EmbeddingError("Cannot embed empty text.");
      }
    }

    const missing = [...new Set(texts.filter((text) => !cache.has(text)))];
    if (missing.length > 0) {
      const vectors = await requestEmbeddings(missing);
      missing.forEach((text, i) => cache.set(text, vectors[i]));
    }

    return texts.map((text) => /** @type {number[]} */ (cache.get(text)));
  }

  /** @type {EmbeddingService["embed"]} */
  async function embed(text) {
    const [vector] = await embedMany([text]);
    return vector;
  }

  return { model, embedMany, embed };
}

/**
 * Never trust an API response blindly: check it has the shape we expect.
 *
 * @param {unknown} embeddings
 * @param {number} expectedCount
 * @returns {number[][]}
 */
function validateEmbeddings(embeddings, expectedCount) {
  if (!Array.isArray(embeddings)) {
    throw new EmbeddingError("Embedding response is missing the 'embeddings' array.");
  }
  if (embeddings.length !== expectedCount) {
    throw new EmbeddingError(
      `Expected ${expectedCount} embeddings but received ${embeddings.length}.`
    );
  }

  const dimensions = Array.isArray(embeddings[0]) ? embeddings[0].length : 0;
  for (const vector of embeddings) {
    if (
      !Array.isArray(vector) ||
      vector.length === 0 ||
      vector.length !== dimensions ||
      !vector.every(Number.isFinite)
    ) {
      throw new EmbeddingError("Embedding response contains an invalid vector.");
    }
  }

  return embeddings;
}

module.exports = { createEmbeddingService, EmbeddingError };
