const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cosineSimilarity } = require("../src/services/similarityService");

test("worked example from the docs is ~0.996", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [2, 4, 5]) - 0.9960) < 0.0001);
});

test("same direction scores 1, regardless of length", () => {
  assert.equal(cosineSimilarity([1, 2, 3], [2, 4, 6]), 1);
});

test("perpendicular vectors score 0", () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("opposite vectors score -1", () => {
  // Floating-point math gives -0.9999999999999998, so compare approximately.
  assert.ok(Math.abs(cosineSimilarity([1, 2], [-1, -2]) - -1) < 1e-12);
});

test("zero-magnitude vector returns 0 instead of dividing by zero", () => {
  assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
});

test("mismatched dimensions throw", () => {
  assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]), /do not match/);
});

test("empty vectors throw", () => {
  assert.throws(() => cosineSimilarity([], []), /empty/);
});

test("non-numeric values throw", () => {
  assert.throws(() => cosineSimilarity([1, NaN], [1, 2]), /non-numeric/);
});
