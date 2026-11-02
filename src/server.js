/**
 * HTTP server for the web frontend.
 *
 *   GET  /              the search page (public/index.html, styles.css, app.js)
 *   GET  /api/health    { status, indexedTickets, embeddingModel, llmModel }
 *   POST /api/search    { query: string, k?: number } -> { results: [...] }
 *   POST /api/rag       { query: string, k?: number } -> { retrievedTickets: [...], generatedResponse: string }
 *
 * The browser never talks to Ollama directly; it only calls /api/search or /api/rag.
 * The index is built once at startup and reused for every request.
 */

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { tickets } = require("./data/tickets");
const { createEmbeddingService, EmbeddingError } = require("./services/embeddingService");
const { createLlmService, LlmError } = require("./services/llmService");
const { buildIndex, search } = require("./services/semanticSearchService");
const { generateResponse } = require("./services/ragService");

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 10_000;
const MAX_K = 10;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Only these files are served, so no request can read anything else on disk.
const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
};

const embedder = createEmbeddingService();
const llm = createLlmService();

/** @type {Promise<import('./types/ticket').IndexedTicket[]> | null} */
let indexPromise = null;

/**
 * Build the index once. If it fails (e.g. Ollama not running yet),
 * forget the failure so the next request tries again.
 */
function getIndex() {
  if (!indexPromise) {
    indexPromise = buildIndex(tickets, embedder)
      .then(({ index, skipped }) => {
        console.log(`Indexed ${index.length} tickets with "${embedder.model}".`);
        if (skipped.length > 0) {
          console.log(`Skipped (no text): ${skipped.map((t) => t.id).join(", ")}`);
        }
        return index;
      })
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

/**
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} body
 */
function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/**
 * @param {http.IncomingMessage} req
 * @returns {Promise<any>}
 */
async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleSearch(req, res) {
  const body = await readJson(req);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const k = body?.k === undefined ? 3 : Number(body.k);

  if (!query) {
    sendJson(res, 400, { error: "Please describe the issue." });
    return;
  }
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) {
    sendJson(res, 400, { error: `k must be a whole number from 1 to ${MAX_K}.` });
    return;
  }

  const index = await getIndex();
  const results = await search(query, index, embedder, k);

  sendJson(res, 200, {
    query,
    model: embedder.model,
    results: results.map(({ ticket, similarity }) => ({
      ...ticket,
      similarity: Number(similarity.toFixed(4)),
    })),
  });
}

/**
 * Print what was retrieved and exactly what the LLM saw, so RAG answers can be debugged.
 * @param {string} query
 * @param {import('./types/ticket').SearchResult[]} retrievedTickets
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} generatedResponse
 */
function logRagExchange(query, retrievedTickets, systemPrompt, userPrompt, generatedResponse) {
  const divider = "=".repeat(70);
  console.log(`\n${divider}\nRAG query: "${query}"\n${divider}`);

  console.log("\n--- Similar tickets ---");
  console.table(
    retrievedTickets.map(({ ticket, similarity }) => ({
      id: ticket.id,
      similarity: Number(similarity.toFixed(4)),
      title: ticket.title,
      category: ticket.category,
    }))
  );

  console.log("\n--- System prompt sent to LLM ---");
  console.log(systemPrompt);
  console.log("\n--- User prompt sent to LLM ---");
  console.log(userPrompt);
  console.log(`\n--- LLM response (${llm.model}) ---`);
  console.log(generatedResponse);
  console.log(divider);
}

/**
 * RAG: retrieve similar tickets + generate a response
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleRag(req, res) {
  const body = await readJson(req);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const k = body?.k === undefined ? 3 : Number(body.k);

  if (!query) {
    sendJson(res, 400, { error: "Please describe the issue." });
    return;
  }
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) {
    sendJson(res, 400, { error: `k must be a whole number from 1 to ${MAX_K}.` });
    return;
  }

  const index = await getIndex();
  const { query: q, retrievedTickets, systemPrompt, userPrompt, generatedResponse } =
    await generateResponse(query, index, embedder, llm, k);

  logRagExchange(q, retrievedTickets, systemPrompt, userPrompt, generatedResponse);

  sendJson(res, 200, {
    query: q,
    embeddingModel: embedder.model,
    llmModel: llm.model,
    retrievedTickets: retrievedTickets.map(({ ticket, similarity }) => ({
      ...ticket,
      similarity: Number(similarity.toFixed(4)),
    })),
    generatedResponse,
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;

  try {
    if (req.method === "GET" && STATIC_FILES[pathname]) {
      const [file, contentType] = STATIC_FILES[pathname];
      const content = await fs.readFile(path.join(PUBLIC_DIR, file));
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
      return;
    }

    if (req.method === "GET" && pathname === "/api/health") {
      const index = await getIndex().catch(() => []);
      sendJson(res, 200, {
        status: "ok",
        indexedTickets: index.length,
        embeddingModel: embedder.model,
        llmModel: llm.model,
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/search") {
      await handleSearch(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/rag") {
      await handleRag(req, res);
      return;
    }

    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    const err = /** @type {Error & { statusCode?: number }} */ (error);
    if (err.statusCode) {
      sendJson(res, err.statusCode, { error: err.message });
    } else if (err instanceof EmbeddingError || err instanceof LlmError) {
      console.error(err.message);
      sendJson(res, 503, { error: err.message });
    } else {
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong on the server." });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Similar Ticket Search running at http://localhost:${PORT}`);
  getIndex().catch((error) => console.error(`Indexing failed: ${error.message}`));
});
