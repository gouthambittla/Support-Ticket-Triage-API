# RAG Implementation: Step-by-Step Explanation

You just built **Retrieval-Augmented Generation (RAG)** on top of your semantic search. Here's exactly what happens, step by step.

## The Big Picture

```
Customer describes an issue
         ↓
    [STEP 1: RETRIEVAL]
    Find 3 similar past tickets
         ↓
    [STEP 2: AUGMENTED]
    Format them as readable context
         ↓
    [STEP 3: GENERATION]
    Send to LLM: "Here are past solutions, write a response"
         ↓
    [STEP 4: DISPLAY]
    Show the LLM's response + the tickets it used
```

---

## Step 1: Retrieval (Your Semantic Search)

**What happens:** The app finds tickets with similar meaning.

**File:** [src/services/semanticSearchService.js](src/services/semanticSearchService.js)

**Code:**
```javascript
const retrievedTickets = await search(query, index, embedder, k);
```

**Input:** 
- `query`: "My Wi-Fi keeps disconnecting"
- `index`: 18 indexed tickets with embeddings
- `k`: 2 (get top 2)

**Output:**
```javascript
[
  {
    ticket: { id: "TICKET-101", title: "Frequent Wi-Fi disconnections", ... },
    similarity: 0.848
  },
  {
    ticket: { id: "TICKET-102", title: "Internet keeps cutting out", ... },
    similarity: 0.780
  }
]
```

**Why this matters:** We found the right tickets. The LLM will read these, not random ones.

---

## Step 2: Augmented — Format as Context

**What happens:** Turn the tickets into readable text the LLM can understand.

**File:** [src/services/ragService.js](src/services/ragService.js) → `formatRetrievedTickets()`

**Code:**
```javascript
function formatRetrievedTickets(tickets) {
  return tickets
    .map(({ ticket, similarity }, i) => [
      `${i + 1}. ${ticket.id}: "${ticket.title}" (similarity: ${similarity.toFixed(3)})`,
      `   Issue: ${ticket.description}`,
      `   Resolution: ${ticket.resolution}`
    ].join("\n"))
    .join("\n\n");
}
```

**Output:**
```
1. TICKET-101: "Frequent Wi-Fi disconnections" (similarity: 0.848)
   Issue: The Wi-Fi connection drops every few minutes, and I need to reconnect.
   Resolution: Restarted the router and checked for firmware updates.

2. TICKET-102: "Internet keeps cutting out" (similarity: 0.780)
   Issue: My internet goes down for a minute or two several times an hour.
   Resolution: Replaced a damaged coaxial cable at the wall outlet.
```

**Why this matters:** The LLM sees the context in a readable format. It can parse the issues and resolutions.

---

## Step 3: Generation — Call the LLM

**What happens:** Send the context + a prompt to the LLM, and it writes a response.

**Files:** 
- [src/services/llmService.js](src/services/llmService.js) — talks to Ollama's chat API
- [src/services/ragService.js](src/services/ragService.js) → `generateResponse()` — orchestrates

**Code:**
```javascript
const systemPrompt = `You are a helpful support agent. Use the similar past tickets 
to provide helpful guidance. Be concise and actionable.`;

const userPrompt = `Customer's issue:
"My Wi-Fi keeps disconnecting"

Similar past tickets and their resolutions:
${ticketContext}

Based on these similar cases, provide a response.`;

const generatedResponse = await llm.generate(systemPrompt, userPrompt);
```

**Step 3a: The LLM Model**

Your server uses **llama2** (from `OLLAMA_MODEL` env var).

Ollama calls the model:
```
POST http://localhost:11434/api/chat
{
  "model": "llama2",
  "messages": [
    { "role": "system", "content": "You are a helpful support agent..." },
    { "role": "user", "content": "Customer's issue: ...\n\nSimilar cases: ..." }
  ],
  "stream": false,
  "temperature": 0.3
}
```

**Temperature = 0.3:** Low = more consistent, less creative. Good for support (not making stuff up).

**Step 3b: The LLM Reads What You Give It**

The LLM ONLY sees what you passed to it:
- The customer's query
- The 2 retrieved tickets and their resolutions
- Instructions to be helpful

**The LLM cannot:**
- Search on its own
- Rank or sort
- Access the full database
- See tickets you didn't pass

**The LLM can:**
- Synthesize the information
- Write naturally
- Apply reasoning to the situation

**Step 3c: The LLM Generates a Response**

It reads the past solutions and writes something like:

```
Dear Customer,

Thank you for contacting us. We've seen several similar issues 
in the past. Based on successful resolutions:

1. First, try restarting your router and checking for firmware 
   updates (this worked in 40% of cases).

2. If that doesn't work, check your cables for damage. We've 
   had issues where the coaxial cable was damaged at the wall 
   outlet.

3. If neither works, we can investigate further. Please let us 
   know which step you tried.

We're here to help!
```

**Why this is better than just showing the tickets:**
- Synthesizes multiple solutions
- Speaks in a natural, friendly way
- Prioritizes common solutions first
- Gives the customer a clear action plan

---

## Step 4: Display — Show Both

**File:** [public/app.js](public/app.js) → `runRag()`

The page shows:

```
┌─────────────────────────────────────────────────────────┐
│                  Generated Response                      │
│                                                           │
│  Dear Customer,                                           │
│  Thank you for contacting us. Based on similar cases:   │
│  1. Restart your router...                              │
│  2. Check your cables...                                │
│                                                           │
│  Using nomic-embed-text (retrieval) and llama2 (gen)    │
└─────────────────────────────────────────────────────────┘

        ┌─ Retrieved Similar Tickets ─┐
        │                             │
        │ 1. [0.848] TICKET-101       │
        │    Frequent Wi-Fi drops     │
        │    ...                      │
        │                             │
        │ 2. [0.780] TICKET-102       │
        │    Internet cuts out        │
        │    ...                      │
        └─────────────────────────────┘
```

**Why show both:**
- User sees the LLM's reasoning (the tickets)
- User can verify the solution is based on real cases
- User can click a ticket to read the full resolution

---

## How It All Connects

```
┌──────────────────────────────────┐
│ embeddingService.js              │
│ (Ollama + nomic-embed-text)      │
│                                  │
│ Text → [768 numbers]             │
└────────────────┬─────────────────┘
                 │
                 ├──► semanticSearchService.js
                 │    (Cosine similarity)
                 │    Ranks tickets
                 │
                 └──► ragService.js
                      - Retrieves top K
                      - Formats context
                      - Calls LLM
                      │
                      ▼
                 llmService.js
                 (Ollama + llama2)
                 Context → Helpful response
```

---

## File Changes Summary

### New Files

| File | Purpose |
|---|---|
| `src/services/llmService.js` | Talks to Ollama's chat API. Sends text, gets response. |
| `src/services/ragService.js` | Orchestrates retrieval → formatting → generation. |

### Modified Files

| File | Changes |
|---|---|
| `src/server.js` | Added `/api/rag` endpoint. Added LLM service initialization. |
| `public/index.html` | Added "Search + Generate" button. Added template for generated response. |
| `public/styles.css` | Styled the generated response section (blue/accent color). |
| `public/app.js` | Added `runRag()` function to call `/api/rag` and display results. |

---

## Endpoint: POST /api/rag

**Request:**
```json
{
  "query": "My Wi-Fi keeps disconnecting",
  "k": 2
}
```

**Response:**
```json
{
  "query": "My Wi-Fi keeps disconnecting",
  "embeddingModel": "nomic-embed-text",
  "llmModel": "llama2",
  "retrievedTickets": [
    {
      "id": "TICKET-101",
      "title": "Frequent Wi-Fi disconnections",
      "description": "...",
      "category": "Connectivity",
      "status": "Resolved",
      "resolution": "Restarted the router...",
      "similarity": 0.848
    },
    ...
  ],
  "generatedResponse": "Dear Customer, Thank you for contacting us..."
}
```

---

## Key Differences: Search vs. RAG

| | Search | RAG |
|---|---|---|
| **Endpoint** | `/api/search` | `/api/rag` |
| **What it finds** | Similar tickets | Similar tickets |
| **What it generates** | Nothing | A helpful response |
| **Response format** | List of tickets | Tickets + generated text |
| **Use case** | Show relevant past cases | Draft a customer reply |

---

## The LLM Does NOT

- **Search or rank.** Semantic search does that.
- **Make up new information.** It only reads what you gave it.
- **Know what's accurate.** If a past resolution is wrong, the LLM might repeat it.
- **Guarantee a good answer.** It's probabilistic; sometimes it hallucinates.

---

## The LLM Does

- **Synthesize.** Reads 3 tickets, writes one coherent response.
- **Write naturally.** Sounds like a human, not robotic.
- **Adapt tone.** Can be formal, casual, technical, etc.
- **Apply reasoning.** "These 3 cases all mention rebooting, so try that first."

---

## Next Steps

Now that you understand RAG, you could:

1. **Prompt engineering:** Tweak `systemPrompt` and `userPrompt` to change the LLM's behavior.
2. **Temperature tuning:** Lower (0.1) = more consistent, higher (0.8) = more creative.
3. **Model swapping:** Use `OLLAMA_MODEL=neural-chat` for a model trained on dialogue.
4. **Filtering:** Only retrieve tickets with `status: "Resolved"`.
5. **Multi-LLM:** Use one model for retrieval, another for generation.
6. **Hybrid:** Combine semantic search + keyword search to find more tickets.
7. **Evaluation:** Did the LLM write a good response? Build a test set.

---

## Summary

**RAG = Retrieval + Augmented + Generation**

- **Retrieval:** Semantic search finds the 3 most similar past tickets.
- **Augmented:** Format them as readable context.
- **Generation:** Pass context to LLM, which writes a response.

The LLM **never searches**. It only reads what retrieval found. This makes RAG:
- **Fast:** No need to send the whole database to the LLM.
- **Safe:** The LLM can only say things about tickets that exist.
- **Verifiable:** Users see which tickets the answer came from.

