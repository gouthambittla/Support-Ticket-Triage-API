const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createEmbeddingService, EmbeddingError } = require("../src/services/embeddingService");

/**
 * A stand-in for `fetch` that returns a canned response and counts calls,
 * so these tests run without Ollama.
 *
 * @param {(body: any) => { status?: number, json?: unknown, text?: string }} reply
 */
function fakeFetch(reply) {
  const calls = [];
  /** @type {any} */
  const fn = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const { status = 200, json, text } = reply(body);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (text !== undefined) throw new SyntaxError("Unexpected token");
        return json;
      },
      text: async () => text ?? JSON.stringify(json),
    };
  };
  return { fn, calls };
}

const twoDimVectors = (body) => ({
  json: { embeddings: body.input.map((_, i) => [i + 1, 1]) },
});

test("returns one vector per input text", async () => {
  const { fn } = fakeFetch(twoDimVectors);
  const service = createEmbeddingService({ fetchFn: fn });
  assert.deepEqual(await service.embedMany(["a", "b"]), [[1, 1], [2, 1]]);
});

test("caches: unchanged text is not sent to the model twice", async () => {
  const { fn, calls } = fakeFetch(twoDimVectors);
  const service = createEmbeddingService({ fetchFn: fn });
  await service.embedMany(["wifi drops", "billing"]);
  await service.embed("wifi drops");
  await service.embedMany(["wifi drops", "new ticket"]);
  assert.deepEqual(calls.map((c) => c.input), [["wifi drops", "billing"], ["new ticket"]]);
});

test("uses the configured model for every request", async () => {
  const { fn, calls } = fakeFetch(twoDimVectors);
  const service = createEmbeddingService({ fetchFn: fn, model: "my-model" });
  await service.embed("x");
  assert.equal(calls[0].model, "my-model");
});

test("network failure becomes a helpful EmbeddingError", async () => {
  const service = createEmbeddingService({
    fetchFn: async () => {
      throw new TypeError("fetch failed");
    },
  });
  await assert.rejects(service.embed("x"), (error) => {
    assert.ok(error instanceof EmbeddingError);
    assert.match(error.message, /Is it running/);
    return true;
  });
});

test("HTTP error status is reported", async () => {
  const { fn } = fakeFetch(() => ({ status: 404, json: { error: "model not found" } }));
  const service = createEmbeddingService({ fetchFn: fn });
  await assert.rejects(service.embed("x"), /HTTP 404.*model not found/);
});

test("non-JSON response is rejected", async () => {
  const { fn } = fakeFetch(() => ({ text: "<html>oops</html>" }));
  await assert.rejects(createEmbeddingService({ fetchFn: fn }).embed("x"), /not valid JSON/);
});

for (const [name, json, pattern] of [
  ["missing embeddings field", { data: [] }, /missing/],
  ["wrong number of vectors", { embeddings: [[1, 2], [3, 4]] }, /Expected 1/],
  ["empty vector", { embeddings: [[]] }, /invalid vector/],
  ["non-numeric values", { embeddings: [[1, "two"]] }, /invalid vector/],
]) {
  test(`invalid response rejected: ${name}`, async () => {
    const { fn } = fakeFetch(() => ({ json }));
    await assert.rejects(createEmbeddingService({ fetchFn: fn }).embed("x"), pattern);
  });
}

test("mixed vector dimensions are rejected", async () => {
  const { fn } = fakeFetch(() => ({ json: { embeddings: [[1, 2], [1, 2, 3]] } }));
  await assert.rejects(
    createEmbeddingService({ fetchFn: fn }).embedMany(["a", "b"]),
    /invalid vector/
  );
});

test("empty text is rejected before calling the API", async () => {
  const { fn, calls } = fakeFetch(twoDimVectors);
  await assert.rejects(createEmbeddingService({ fetchFn: fn }).embed("   "), /empty text/);
  assert.equal(calls.length, 0);
});
