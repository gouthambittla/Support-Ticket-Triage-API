const { generateEmbedding } = require("./embeddings");
const { ticketStore } = require("./ticketStore");

/**
 * Get suggested solutions based on similar tickets
 * @param {string} ticketText - the ticket to find solutions for
 * @param {number} topK - number of similar tickets to consider
 * @returns {Promise<Array>} suggested solutions
 */
async function getSuggestedSolutions(ticketText, topK = 3) {
  // Generate embedding for the new ticket (already have this from triage)
  const embedding = await generateEmbedding(ticketText);

  // Find similar tickets
  const similarTickets = ticketStore.findSimilar(embedding, topK, 0.5);

  if (similarTickets.length === 0) {
    return [];
  }

  // Extract solutions from similar tickets
  const solutions = similarTickets.map((result, index) => ({
    rank: index + 1,
    similarity: Number(result.similarity.toFixed(4)),
    ticketId: result.ticket.id,
    originalTicket: result.ticket.text,
    suggestedCategory: result.ticket.triage.category,
    suggestedPriority: result.ticket.triage.priority,
    suggestedTeam: result.ticket.triage.team,
    suggestedSummary: result.ticket.triage.summary,
    requiesHumanReview: result.ticket.triage.requires_human_review,
  }));

  return solutions;
}

module.exports = { getSuggestedSolutions };
