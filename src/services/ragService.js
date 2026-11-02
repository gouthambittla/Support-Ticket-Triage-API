/**
 * RAG = Retrieval-Augmented Generation
 *
 * Workflow:
 *   1. RETRIEVAL: semantic search finds top K tickets
 *   2. AUGMENTED: format those tickets as readable context
 *   3. GENERATION: send context to LLM to generate a response
 *
 * The LLM never searches or ranks — it only reads what semantic search found
 * and writes a response based on it.
 */

const { search } = require("./semanticSearchService");

/** @typedef {import('../types/ticket').IndexedTicket} IndexedTicket */
/** @typedef {import('./llmService').LlmService} LlmService */
/** @typedef {Pick<import('./embeddingService').EmbeddingService, "embed" | "embedMany">} Embedder */

/**
 * Format retrieved tickets as readable context for the LLM.
 * The LLM only sees what we show it.
 *
 * @param {import('../types/ticket').SearchResult[]} tickets
 * @returns {string}
 */
function formatRetrievedTickets(tickets) {
  if (tickets.length === 0) {
    return "No similar past tickets found.";
  }

  const lines = tickets.map(({ ticket, similarity }, i) => {
    const lines_parts = [
      `${i + 1}. ${ticket.id}: "${ticket.title}" (similarity: ${similarity.toFixed(3)})`,
      `   Issue: ${ticket.description}`,
    ];
    if (ticket.resolution) {
      lines_parts.push(`   Resolution: ${ticket.resolution}`);
    }
    return lines_parts.join("\n");
  });

  return lines.join("\n\n");
}

/**
 * @param {string} query  The customer's issue.
 * @param {IndexedTicket[]} index  The indexed tickets.
 * @param {Embedder} embedder  Embedding service.
 * @param {LlmService} llm  The LLM service.
 * @param {number} [k=3]  How many tickets to retrieve.
 * @returns {Promise<{ query: string, retrievedTickets: import('../types/ticket').SearchResult[], systemPrompt: string, userPrompt: string, generatedResponse: string }>}
 */
async function generateResponse(query, index, embedder, llm, k = 3) {
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error("Query must not be empty.");
  }

  // STEP 1: RETRIEVAL — find similar tickets
  const retrievedTickets = await search(query, index, embedder, k);

  // STEP 2: AUGMENTED — format them as context
  const ticketContext = formatRetrievedTickets(retrievedTickets);

  // STEP 3: GENERATION — send to LLM
  const systemPrompt =
    `You are a helpful support agent. A customer has submitted a support ticket.
Use the similar past tickets below to understand the issue and provide helpful guidance.
Be concise, friendly, and actionable. Avoid repeating the exact past solutions;
instead, synthesize them into the best advice for this customer.`;

  const userPrompt = `Customer's issue:
"${query}"

Similar past tickets and their resolutions:
${ticketContext}

Based on these similar cases, provide a helpful response to the customer.`;

  const generatedResponse = await llm.generate(systemPrompt, userPrompt);

  return {
    query,
    retrievedTickets,
    systemPrompt,
    userPrompt,
    generatedResponse,
  };
}

module.exports = { formatRetrievedTickets, generateResponse };
