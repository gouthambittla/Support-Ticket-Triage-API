/**
 * Calls the LLM (chat model) to generate text responses.
 *
 * This is separate from embeddingService.js because:
 * - embeddingService turns text into vectors (one-way, deterministic)
 * - llmService turns context + prompt into creative text (two-way, probabilistic)
 *
 * Both talk to Ollama, but they use different models and endpoints.
 */

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama2";
const REQUEST_TIMEOUT_MS = 120_000;

class LlmError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(message, options) {
    super(message, options);
    this.name = "LlmError";
  }
}

/**
 * @typedef {Object} LlmService
 * @property {string} model
 * @property {(systemPrompt: string, userPrompt: string) => Promise<string>} generate
 */

/**
 * @param {Object} [options]
 * @param {string} [options.baseUrl]  Ollama server URL.
 * @param {string} [options.model]    Chat model name.
 * @param {typeof fetch} [options.fetchFn]  Injectable for tests.
 * @returns {LlmService}
 */
function createLlmService({
  baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.OLLAMA_MODEL || DEFAULT_MODEL,
  fetchFn = fetch,
} = {}) {
  /**
   * @param {string} systemPrompt  Instructions for how the LLM should behave.
   * @param {string} userPrompt    The actual query/context to respond to.
   * @returns {Promise<string>}    The LLM's generated response.
   */
  async function generate(systemPrompt, userPrompt) {
    let response;
    try {
      response = await fetchFn(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
          temperature: 0.3, // Lower = more consistent, less creative
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new LlmError(
        `Could not reach Ollama at ${baseUrl}. Is it running? (try: ollama serve)`,
        { cause: error }
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new LlmError(
        `LLM request failed with HTTP ${response.status}: ${body.slice(0, 200)}`
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new LlmError("LLM response was not valid JSON.", { cause: error });
    }

    const message = data?.message?.content;
    if (typeof message !== "string" || message.trim() === "") {
      throw new LlmError("LLM returned an empty response.");
    }

    return message.trim();
  }

  return { model, generate };
}

module.exports = { createLlmService, LlmError };
