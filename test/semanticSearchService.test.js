const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ticketToText, buildIndex, search } = require("../src/services/semanticSearchService");

/**
 * A fake embedder with hand-picked 3-number "meanings":
 *   [connectivity, billing, account]
 * This lets us test ranking logic without a real model.
 */
const MEANINGS = {
  wifi: [0.9, 0.1, 0.0],
  internet: [0.8, 0.2, 0.1],
  charged: [0.0, 0.9, 0.1],
  password: [0.1, 0.0, 0.9],
};

function vectorFor(text) {
  const key = Object.keys(MEANINGS).find((word) => text.toLowerCase().includes(word));
  return key ? MEANINGS[key] : [0.3, 0.3, 0.3];
}

const fakeEmbedder = {
  calls: 0,
  async embed(text) {
    this.calls++;
    return vectorFor(text);
  },
  async embedMany(texts) {
    this.calls++;
    return texts.map(vectorFor);
  },
};

function ticket(id, title, description = "") {
  return { id, title, description, category: "", status: "Resolved", resolution: "" };
}

const tickets = [
  ticket("T1", "Wifi drops"),
  ticket("T2", "Charged twice"),
  ticket("T3", "Forgot password"),
  ticket("T4", "Internet cutting out"),
];

test("ticketToText joins title and description", () => {
  assert.equal(ticketToText(ticket("x", " Wifi drops ", "Every hour.")), "Wifi drops. Every hour.");
});

test("ticketToText handles missing or empty fields", () => {
  assert.equal(ticketToText(ticket("x", "", "Only description")), "Only description");
  assert.equal(ticketToText({ id: "x" }), "");
});

test("ranks related tickets above unrelated ones, highest first", async () => {
  const { index } = await buildIndex(tickets, fakeEmbedder);
  const results = await search("my wifi is unstable", index, fakeEmbedder, 4);
  // The two connectivity tickets win; T2 and T3 tie, so their order is not checked.
  assert.deepEqual(results.slice(0, 2).map((r) => r.ticket.id), ["T1", "T4"]);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].similarity >= results[i].similarity);
  }
});

test("returns exactly k results, or fewer when there are fewer tickets", async () => {
  const { index } = await buildIndex(tickets, fakeEmbedder);
  assert.equal((await search("wifi", index, fakeEmbedder, 1)).length, 1);
  assert.equal((await search("wifi", index, fakeEmbedder, 2)).length, 2);
  assert.equal((await search("wifi", index, fakeEmbedder, 10)).length, 4);
});

test("invalid k is rejected", async () => {
  const { index } = await buildIndex(tickets, fakeEmbedder);
  for (const k of [0, -1, 1.5, NaN]) {
    await assert.rejects(search("wifi", index, fakeEmbedder, k), /positive whole number/);
  }
});

test("empty query is rejected", async () => {
  const { index } = await buildIndex(tickets, fakeEmbedder);
  await assert.rejects(search("   ", index, fakeEmbedder), /must not be empty/);
});

test("no tickets: empty index, empty results, no API call", async () => {
  fakeEmbedder.calls = 0;
  const { index } = await buildIndex([], fakeEmbedder);
  assert.deepEqual(index, []);
  assert.deepEqual(await search("wifi", index, fakeEmbedder), []);
  assert.equal(fakeEmbedder.calls, 0);
});

test("tickets with no title and description are skipped, not embedded", async () => {
  const { index, skipped } = await buildIndex(
    [...tickets, ticket("EMPTY", "", "   ")],
    fakeEmbedder
  );
  assert.equal(index.length, 4);
  assert.deepEqual(skipped.map((t) => t.id), ["EMPTY"]);
});

test("embedding failures propagate to the caller", async () => {
  const broken = {
    embed: async () => {
      throw new Error("Ollama down");
    },
    embedMany: async () => {
      throw new Error("Ollama down");
    },
  };
  await assert.rejects(buildIndex(tickets, broken), /Ollama down/);
  const { index } = await buildIndex(tickets, fakeEmbedder);
  await assert.rejects(search("wifi", index, broken), /Ollama down/);
});
