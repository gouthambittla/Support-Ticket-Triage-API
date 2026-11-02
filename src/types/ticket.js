/**
 * The shapes of data used across the app.
 *
 * This file contains no logic. It only describes what a ticket looks like,
 * so VS Code can autocomplete fields and warn about typos like `ticket.titel`.
 */

/**
 * A historical support ticket, exactly as stored in the dataset.
 *
 * @typedef {Object} Ticket
 * @property {string} id           Unique identifier, e.g. "TICKET-101".
 * @property {string} title        Short summary written by the customer or agent.
 * @property {string} description  Full explanation of the problem.
 * @property {string} category     Topic, e.g. "Connectivity", "Billing".
 * @property {"Open" | "In Progress" | "Resolved" | "Closed"} status
 * @property {string} resolution   How it was fixed ("" if not resolved yet).
 */

/**
 * A ticket together with its embedding, which is what we keep in memory
 * after the "prepare" phase.
 *
 * @typedef {Object} IndexedTicket
 * @property {Ticket} ticket
 * @property {number[]} embedding  The vector produced by the embedding model.
 */

/**
 * One row of search output: a ticket plus how similar it is to the query.
 *
 * @typedef {Object} SearchResult
 * @property {Ticket} ticket
 * @property {number} similarity   Cosine similarity, between -1 and 1.
 */

// Nothing to export at runtime. Other files reference these types with
// /** @type {import('../types/ticket').Ticket} */
module.exports = {};
