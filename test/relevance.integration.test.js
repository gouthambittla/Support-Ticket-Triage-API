/**
 * End-to-end relevance check with the real embedding model.
 * Skipped automatically when Ollama is not running.
 *
 * Expectation: the top result for each query belongs to the expected category.
 * This is a loose check — semantic search is not guaranteed to be perfect.
 */
const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const { tickets } = require("../src/data/tickets");
const { createEmbeddingService } = require("../src/services/embeddingService");
const { buildIndex, search } = require("../src/services/semanticSearchService");

const CASES = [
  ["My internet keeps disconnecting.", "Connectivity"],
  ["The Wi-Fi connection drops repeatedly.", "Connectivity"],
  ["I cannot make a payment.", "Payment"],
  ["My internet is extremely slow.", "Slow Speed"],
  ["I cannot log in to my account.", "Account Access"],
  ["I was billed two times for the same month.", "Billing"],
];

const embedder = createEmbeddingService();
let index = [];
let ollamaUp = true;

before(async () => {
  try {
    ({ index } = await buildIndex(tickets, embedder));
  } catch {
    ollamaUp = false;
  }
});

for (const [query, expectedCategory] of CASES) {
  test(`"${query}" → top result is ${expectedCategory}`, async (t) => {
    if (!ollamaUp) return t.skip("Ollama is not reachable");
    const [top] = await search(query, index, embedder, 1);
    assert.equal(top.ticket.category, expectedCategory, `got ${top.ticket.id} "${top.ticket.title}"`);
  });
}
