const { OpenAI } = require("openai");

const client = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
});

/**
 * Generate embedding for a given text using Ollama
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function generateEmbedding(text) {
  const model = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";

  const response = await client.embeddings.create({
    model,
    input: text,
  });

  if (!response.data[0]?.embedding) {
    throw new Error("Failed to generate embedding");
  }

  return response.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity score between 0 and 1
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

module.exports = { generateEmbedding, cosineSimilarity };
