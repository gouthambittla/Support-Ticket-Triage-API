/**
 * Semantic search over tickets, in two phases:
 *
 *   1. buildIndex   (once)        ticket text -> embedding, kept in memory
 *   2. search       (per query)   query -> embedding -> cosine vs every ticket
 *                                 -> sort descending -> top K
 *
 * The index lives in memory only, so it is rebuilt on every start. That is
 * fine for 18 tickets; a real system would persist the embeddings.
 */

const { cosineSimilarity } = require("./similarityService");

/** @typedef {import('../types/ticket').Ticket} Ticket */
/** @typedef {import('../types/ticket').IndexedTicket} IndexedTicket */
/** @typedef {import('../types/ticket').SearchResult} SearchResult */
/** @typedef {Pick<import('./embeddingService').EmbeddingService, "embed" | "embedMany">} Embedder */

/**
 * The text we embed for a ticket. Title and description describe the
 * problem, which is what a new ticket's query also describes. Using one
 * consistent format means identical tickets always produce identical text.
 *
 * @param {Partial<Ticket>} ticket
 * @returns {string} "" when the ticket has no usable text.
 */
function ticketToText(ticket) {
  return [ticket.title, ticket.description]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(". ");
}

/**
 * @param {Ticket[]} tickets
 * @param {Embedder} embedder
 * @returns {Promise<{ index: IndexedTicket[], skipped: Ticket[] }>}
 *   `skipped` lists tickets with no title or description to embed.
 */
async function buildIndex(tickets, embedder) {
  const usable = [];
  const skipped = [];
  for (const ticket of tickets) {
    (ticketToText(ticket) ? usable : skipped).push(ticket);
  }

  if (usable.length === 0) {
    return { index: [], skipped };
  }

  const embeddings = await embedder.embedMany(usable.map(ticketToText));
  const index = usable.map((ticket, i) => ({ ticket, embedding: embeddings[i] }));
  return { index, skipped };
}

/**
 * @param {string} query  A new ticket description.
 * @param {IndexedTicket[]} index
 * @param {Embedder} embedder  Must be the same model used to build the index.
 * @param {number} [k=3]  How many results to return.
 * @returns {Promise<SearchResult[]>}
 */
async function search(query, index, embedder, k = 3) {
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error("Search query must not be empty.");
  }
  if (!Number.isInteger(k) || k < 1) {
    throw new Error("k must be a positive whole number.");
  }
  if (index.length === 0) {
    return [];
  }

  const queryEmbedding = await embedder.embed(query.trim());

  return index
    .map(({ ticket, embedding }) => ({
      ticket,
      similarity: cosineSimilarity(queryEmbedding, embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

module.exports = { ticketToText, buildIndex, search };
