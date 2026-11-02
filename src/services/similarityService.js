/**
 * Cosine similarity: how closely two vectors point in the same direction.
 *
 *   cosine(A, B) = (A · B) / (||A|| × ||B||)
 *
 * Worked example with 3-number vectors:
 *   A = [1, 2, 3]   B = [2, 4, 5]
 *   A · B  = 1×2 + 2×4 + 3×5        = 25
 *   ||A||  = √(1² + 2² + 3²) = √14  ≈ 3.742
 *   ||B||  = √(2² + 4² + 5²) = √45  ≈ 6.708
 *   cosine = 25 / (3.742 × 6.708)   ≈ 0.996   → nearly the same direction
 *
 * Range: 1 = same direction, 0 = unrelated, -1 = opposite.
 * A score is NOT a probability: 0.90 does not mean "90% likely the same issue".
 *
 * This file knows nothing about Ollama or tickets — it is pure math.
 */

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Similarity between -1 and 1. Returns 0 when either vector
 *   has zero magnitude, because a zero vector has no direction to compare.
 */
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new TypeError("Both inputs must be arrays of numbers.");
  }
  if (a.length === 0 || b.length === 0) {
    throw new Error("Vectors must not be empty.");
  }
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions do not match: ${a.length} vs ${b.length}.`);
  }

  let dotProduct = 0;
  let sumSquaresA = 0;
  let sumSquaresB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    sumSquaresA += a[i] * a[i];
    sumSquaresB += b[i] * b[i];
  }

  const magnitudeA = Math.sqrt(sumSquaresA);
  const magnitudeB = Math.sqrt(sumSquaresB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  const similarity = dotProduct / (magnitudeA * magnitudeB);
  if (!Number.isFinite(similarity)) {
    throw new Error("Vectors contain non-numeric values.");
  }

  // Floating-point rounding can produce 1.0000000002; keep it in range.
  return Math.max(-1, Math.min(1, similarity));
}

module.exports = { cosineSimilarity };
