// Chat frontend for the support assistant.
// Talks only to our own server (/api/...), never to Ollama directly.
// Similar tickets are not shown in the UI; they are logged to the browser console.

const chatEl = document.getElementById("chat");
const welcomeEl = document.getElementById("welcome");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const sendButton = document.getElementById("send");
const statusEl = document.getElementById("status");

let busy = false;

// textContent (not innerHTML) is used everywhere so model or ticket text can
// never inject HTML into the page.
function addMessage(role, text) {
  welcomeEl.hidden = true;
  const row = document.createElement("div");
  row.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
  return bubble;
}

function addTyping() {
  const bubble = addMessage("assistant", "");
  bubble.classList.add("typing");
  bubble.innerHTML = "<span></span><span></span><span></span>";
  return bubble;
}

function logToConsole(data) {
  console.groupCollapsed(`RAG: "${data.query}"`);
  console.log(`Models: ${data.embeddingModel} (retrieval), ${data.llmModel} (generation)`);
  console.table(
    data.retrievedTickets.map((t) => ({
      id: t.id,
      similarity: t.similarity,
      title: t.title,
      category: t.category,
      resolution: t.resolution,
    }))
  );
  console.log("Response:", data.generatedResponse);
  console.groupEnd();
}

async function send(query) {
  if (busy || !query) return;
  busy = true;
  updateSendState();

  addMessage("user", query);
  input.value = "";
  autoResize();
  const pending = addTyping();

  try {
    const response = await fetch("/api/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    logToConsole(data);
    pending.classList.remove("typing");
    pending.textContent = data.generatedResponse;
  } catch (error) {
    pending.classList.remove("typing");
    pending.classList.add("error");
    pending.textContent = error.message;
  } finally {
    busy = false;
    updateSendState();
    chatEl.scrollTop = chatEl.scrollHeight;
    input.focus();
  }
}

function updateSendState() {
  sendButton.disabled = busy || input.value.trim() === "";
}

function autoResize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    if (data.indexedTickets > 0) {
      statusEl.className = "status ok";
      statusEl.title = `${data.indexedTickets} tickets indexed · ${data.llmModel}`;
    } else {
      statusEl.className = "status down";
      statusEl.title = "Tickets not indexed yet — is Ollama running?";
    }
  } catch {
    statusEl.className = "status down";
    statusEl.title = "Cannot reach the server.";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  send(input.value.trim());
});

input.addEventListener("input", () => {
  autoResize();
  updateSendState();
});

// Enter sends; Shift + Enter inserts a new line.
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send(input.value.trim());
  }
});

for (const button of document.querySelectorAll(".suggestion")) {
  button.addEventListener("click", () => send(button.textContent));
}

checkHealth();
input.focus();
