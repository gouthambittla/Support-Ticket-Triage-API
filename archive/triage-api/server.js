require("dotenv").config();

const http = require("node:http");
const { triageTicket } = require("./triage");
const { ticketStore } = require("./ticketStore");
const { generateEmbedding } = require("./embeddings");
const { getSuggestedSolutions } = require("./solutions");

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 1_000_000;

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`)
    .pathname;

  if (req.method === "GET" && pathname === "/") {
    sendJson(res, 200, { message: "Server is running" });
    return;
  }

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "POST" && pathname === "/api/triageTicket") {
    try {
      const body = await readJson(req);
      const ticket = typeof body?.ticket === "string" ? body.ticket.trim() : "";

      if (!ticket) {
        sendJson(res, 400, {
          error: 'A non-empty "ticket" string is required.',
        });
        return;
      }

      console.log(
        `Triaging ticket with model: ${process.env.OLLAMA_MODEL || "llama2"}`,
      );
      const result = await triageTicket(ticket);
      console.log("Triage completed successfully");
      sendJson(res, 200, { triage: result });
    } catch (error) {
      console.error("Ticket triage request failed:", error);
      sendJson(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Unable to triage ticket right now.",
      });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/tickets") {
    const tickets = ticketStore.getAllTickets().map((t) => ({
      id: t.id,
      text: t.text,
      triage: t.triage,
      timestamp: t.timestamp,
    }));
    sendJson(res, 200, { tickets, count: tickets.length });
    return;
  }

  if (req.method === "POST" && pathname === "/api/tickets/similar") {
    try {
      const body = await readJson(req);
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      const topK = body?.topK || 5;
      const threshold = body?.threshold || 0.5;

      if (!text) {
        sendJson(res, 400, {
          error: 'A non-empty "text" string is required.',
        });
        return;
      }

      console.log(
        `Generating embedding with model: ${process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"}`,
      );
      const embedding = await generateEmbedding(text);
      const similar = ticketStore.findSimilar(embedding, topK, threshold);
      console.log(`Found ${similar.length} similar tickets`);

      const results = similar.map((result) => ({
        id: result.ticket.id,
        text: result.ticket.text,
        similarity: Number(result.similarity.toFixed(4)),
        triage: result.ticket.triage,
      }));

      sendJson(res, 200, { results, count: results.length });
    } catch (error) {
      console.error("Similar tickets request failed:", error);
      sendJson(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Unable to find similar tickets right now.",
      });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/tickets/suggest") {
    try {
      const body = await readJson(req);
      const ticket = typeof body?.ticket === "string" ? body.ticket.trim() : "";
      const topK = body?.topK || 3;

      if (!ticket) {
        sendJson(res, 400, {
          error: 'A non-empty "ticket" string is required.',
        });
        return;
      }

      console.log(
        `Getting suggestions using model: ${process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"}`,
      );
      const suggestions = await getSuggestedSolutions(ticket, topK);
      console.log(`Generated ${suggestions.length} suggestions`);

      if (suggestions.length === 0) {
        sendJson(res, 200, {
          suggestions: [],
          message: "No similar tickets found to suggest solutions from.",
        });
        return;
      }

      sendJson(res, 200, { suggestions, count: suggestions.length });
    } catch (error) {
      console.error("Suggest solutions request failed:", error);
      sendJson(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Unable to suggest solutions right now.",
      });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
