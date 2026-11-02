const { cosineSimilarity } = require("./embeddings");

/**
 * In-memory store for tickets with their embeddings
 * @typedef {Object} StoredTicket
 * @property {string} id
 * @property {string} text
 * @property {number[]} embedding
 * @property {Object} triage - triage result
 * @property {number} timestamp
 */

class TicketStore {
  constructor() {
    this.tickets = [];
    this.nextId = 1;
  }

  /**
   * Store a ticket with its embedding and triage result
   * @param {string} text - original ticket text
   * @param {number[]} embedding - embedding vector
   * @param {Object} triage - triage result
   * @returns {Object} stored ticket
   */
  addTicket(text, embedding, triage) {
    const ticket = {
      id: `ticket_${this.nextId++}`,
      text,
      embedding,
      triage,
      timestamp: Date.now(),
    };

    this.tickets.push(ticket);
    return ticket;
  }

  /**
   * Find similar tickets using cosine similarity
   * @param {number[]} embedding - query embedding
   * @param {number} topK - number of results to return
   * @param {number} threshold - minimum similarity score (0-1)
   * @returns {Array<{ticket: Object, similarity: number}>}
   */
  findSimilar(embedding, topK = 5, threshold = 0.5) {
    const similarities = this.tickets.map((ticket) => ({
      ticket,
      similarity: cosineSimilarity(embedding, ticket.embedding),
    }));

    return similarities
      .filter((result) => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Get all stored tickets
   * @returns {Array<Object>}
   */
  getAllTickets() {
    return this.tickets;
  }

  /**
   * Get ticket count
   * @returns {number}
   */
  getCount() {
    return this.tickets.length;
  }

  /**
   * Clear all tickets (for testing)
   */
  clear() {
    this.tickets = [];
    this.nextId = 1;
  }
}

// Singleton instance
const ticketStore = new TicketStore();

module.exports = { ticketStore, TicketStore };
