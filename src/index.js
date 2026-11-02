/**
 * Command-line entry point.
 *
 *   npm start                              interactive: type queries one by one
 *   npm start -- "my wifi keeps dropping"  one search, then exit
 *   npm start -- --k 5 "slow internet"     choose how many results (default 3)
 */

const readline = require("node:readline/promises");
const { tickets } = require("./data/tickets");
const { createEmbeddingService } = require("./services/embeddingService");
const { buildIndex, search } = require("./services/semanticSearchService");

const DEFAULT_K = 3;

/**
 * @param {string[]} args
 * @returns {{ k: number, query: string }}
 */
function parseArgs(args) {
  let k = DEFAULT_K;
  const words = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--k") {
      k = Number(args[++i]);
    } else {
      words.push(args[i]);
    }
  }
  return { k, query: words.join(" ") };
}

/**
 * @param {string} query
 * @param {import('./types/ticket').SearchResult[]} results
 */
function printResults(query, results) {
  console.log(`\nTop ${results.length} matches for: "${query}"\n`);
  if (results.length === 0) {
    console.log("  No tickets available to search.\n");
    return;
  }
  results.forEach(({ ticket, similarity }, i) => {
    console.log(`${i + 1}. [${similarity.toFixed(3)}] ${ticket.id} — ${ticket.title}`);
    console.log(`   ${ticket.description}`);
    console.log(`   ${ticket.category} · ${ticket.status}\n`);
  });
}

async function main() {
  const { k, query } = parseArgs(process.argv.slice(2));
  const embedder = createEmbeddingService();

  console.log(`Indexing ${tickets.length} tickets with "${embedder.model}"...`);
  const started = Date.now();
  const { index, skipped } = await buildIndex(tickets, embedder);
  console.log(`Indexed ${index.length} tickets in ${Date.now() - started} ms.`);
  if (skipped.length > 0) {
    console.log(`Skipped (no text): ${skipped.map((t) => t.id).join(", ")}`);
  }

  if (query) {
    printResults(query, await search(query, index, embedder, k));
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nDescribe a support issue (or type "exit").');
  try {
    while (true) {
      const input = (await rl.question("\n> ")).trim();
      if (input === "exit") break;
      if (input === "") {
        console.log("Please enter a description.");
        continue;
      }
      try {
        printResults(input, await search(input, index, embedder, k));
      } catch (error) {
        console.error(`Search failed: ${/** @type {Error} */ (error).message}`);
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
