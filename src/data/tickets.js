/**
 * Historical support tickets. Data only — no search logic lives here.
 *
 * Several tickets describe the same problem in different words
 * (e.g. 101, 102, 103) so semantic search has something to find that
 * keyword search would miss. The rest are unrelated on purpose, so we
 * can check that they rank lower.
 *
 * @type {import('../types/ticket').Ticket[]}
 */
const tickets = [
  // Connectivity: drops / disconnects
  {
    id: "TICKET-101",
    title: "Frequent Wi-Fi disconnections",
    description: "The Wi-Fi connection drops every few minutes, and I need to reconnect.",
    category: "Connectivity",
    status: "Resolved",
    resolution: "Restarted the router and checked for firmware updates.",
  },
  {
    id: "TICKET-102",
    title: "Internet keeps cutting out",
    description: "My internet goes down for a minute or two several times an hour, then comes back on its own.",
    category: "Connectivity",
    status: "Resolved",
    resolution: "Replaced a damaged coaxial cable at the wall outlet.",
  },
  {
    id: "TICKET-103",
    title: "Wireless signal lost repeatedly",
    description: "Laptops and phones keep losing the wireless network, especially in the evening.",
    category: "Connectivity",
    status: "Resolved",
    resolution: "Changed the Wi-Fi channel to avoid interference from neighbouring networks.",
  },
  {
    id: "TICKET-104",
    title: "No internet at all since this morning",
    description: "None of my devices can get online. The modem's online light is off.",
    category: "Connectivity",
    status: "Resolved",
    resolution: "Area outage; service restored after line repair.",
  },

  // Slow speed
  {
    id: "TICKET-105",
    title: "Very slow internet speed",
    description: "I pay for 500 Mbps but speed tests show only 20 Mbps.",
    category: "Slow Speed",
    status: "Resolved",
    resolution: "Upgraded the customer's modem to a DOCSIS 3.1 model.",
  },
  {
    id: "TICKET-106",
    title: "Videos buffering constantly",
    description: "Streaming keeps pausing to buffer and web pages take ages to load in the evening.",
    category: "Slow Speed",
    status: "Resolved",
    resolution: "Identified neighbourhood congestion; scheduled node split.",
  },
  {
    id: "TICKET-107",
    title: "Downloads are crawling",
    description: "Large file downloads that used to take minutes now take hours.",
    category: "Slow Speed",
    status: "In Progress",
    resolution: "",
  },

  // Billing
  {
    id: "TICKET-108",
    title: "Charged twice this month",
    description: "My bank statement shows two identical charges for my monthly plan.",
    category: "Billing",
    status: "Resolved",
    resolution: "Refunded the duplicate charge.",
  },
  {
    id: "TICKET-109",
    title: "Bill higher than expected",
    description: "This month's invoice is $30 more than usual and I didn't change my plan.",
    category: "Billing",
    status: "Resolved",
    resolution: "Promotional discount had expired; applied a loyalty discount.",
  },
  {
    id: "TICKET-110",
    title: "Need a copy of my invoice",
    description: "I need a PDF of last month's invoice for my expense report.",
    category: "Billing",
    status: "Closed",
    resolution: "Sent the invoice by email and showed where to download it in the portal.",
  },

  // Payment failures
  {
    id: "TICKET-111",
    title: "Card payment declined",
    description: "When I try to pay my bill online, the payment page says my card was declined.",
    category: "Payment",
    status: "Resolved",
    resolution: "Card's billing address did not match; customer updated it and payment succeeded.",
  },
  {
    id: "TICKET-112",
    title: "Unable to pay bill through the app",
    description: "The app shows an error and the Pay Now button does nothing.",
    category: "Payment",
    status: "Resolved",
    resolution: "Bug in app version 4.2; customer updated to 4.3.",
  },
  {
    id: "TICKET-113",
    title: "Autopay did not go through",
    description: "Automatic payment failed this month and now I have a late fee.",
    category: "Payment",
    status: "Resolved",
    resolution: "Expired card on file; late fee waived after customer added a new card.",
  },

  // Router / hardware
  {
    id: "TICKET-114",
    title: "Router lights blinking red",
    description: "The router's power light keeps flashing red and it reboots by itself.",
    category: "Router",
    status: "Resolved",
    resolution: "Faulty power adapter; shipped a replacement.",
  },
  {
    id: "TICKET-115",
    title: "Cannot access router admin page",
    description: "Typing 192.168.1.1 in the browser just times out, so I can't change settings.",
    category: "Router",
    status: "Resolved",
    resolution: "Customer was on a guest network; connected to the main network instead.",
  },

  // Account access
  {
    id: "TICKET-116",
    title: "Forgot my password",
    description: "I can't log in to my account and the password reset email never arrives.",
    category: "Account Access",
    status: "Resolved",
    resolution: "Reset email was in spam; added sender to safe list.",
  },
  {
    id: "TICKET-117",
    title: "Account locked after failed logins",
    description: "After a few wrong password attempts my account says it is locked.",
    category: "Account Access",
    status: "Resolved",
    resolution: "Unlocked the account after identity verification.",
  },
  {
    id: "TICKET-118",
    title: "Two-factor code not received",
    description: "The verification code SMS never arrives, so I cannot sign in.",
    category: "Account Access",
    status: "Open",
    resolution: "",
  },
];

module.exports = { tickets };
