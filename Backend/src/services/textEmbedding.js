/**
 * Sentence embeddings from a free local model served by Ollama
 * (default nomic-embed-text: `ollama pull nomic-embed-text`).
 * Used to compare body marks and clothing by meaning, e.g.
 * "tattoo on left forearm: rose" vs. "he has a rose tattoo on his left arm".
 */
const OLLAMA_URL = String(process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const TIMEOUT_MS = 60_000;

// nomic-embed-text expects these task prefixes.
const PREFIX = { query: "search_query: ", document: "search_document: " };

function normalise(vector) {
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vector.map((v) => v / norm);
}

/**
 * @param {string[]} texts
 * @param {"query"|"document"} kind
 * @returns {Promise<number[][]>} unit-length vectors, same order as texts
 */
async function embedTexts(texts, kind) {
  if (!texts.length) return [];
  const prefix = EMBED_MODEL.startsWith("nomic-embed") ? PREFIX[kind] || "" : "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model: EMBED_MODEL, input: texts.map((t) => prefix + t) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data.error || `Ollama returned ${response.status}.`);
      throw new Error(/not found|pull/i.test(detail) ? `Run: ollama pull ${EMBED_MODEL}` : detail);
    }
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
      throw new Error("Unexpected embedding response.");
    }
    return data.embeddings.map(normalise);
  } finally {
    clearTimeout(timeout);
  }
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

module.exports = { embedTexts, dot, EMBED_MODEL };
