require("dotenv").config();

const http = require("node:http");
const { triageTicket } = require("./triage");

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

      if (!process.env.GEMINI_API_KEY) {
        sendJson(res, 503, {
          error: "Ticket triage is not configured. Set GEMINI_API_KEY.",
        });
        return;
      }

      const result = await triageTicket(ticket);
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

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
