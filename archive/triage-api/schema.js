const { z } = require('zod');

const TicketTriageSchema = z.object({
  category: z
    .enum(['billing', 'technical', 'account', 'feature_request', 'other'])
    .describe('Primary category of the support ticket.'),
  priority: z
    .enum(['low', 'medium', 'high', 'critical'])
    .describe('Business urgency based on impact and wording.'),
  team: z
    .enum(['support', 'engineering', 'billing', 'product', 'security'])
    .describe('Team that should own the ticket.'),
  summary: z
    .string()
    .describe('One-sentence neutral summary of the issue.'),
  requires_human_review: z
    .boolean()
    .describe('True if the ticket is ambiguous, sensitive, or possibly abusive.'),
});

/**
 * @typedef {z.infer<typeof TicketTriageSchema>} TicketTriage
 */

module.exports = { TicketTriageSchema };
