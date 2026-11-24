/**
 * Reads identifying details (scars, tattoos, clothing, ...) from victim photos
 * with a vision model, as structured JSON. The result only pre-fills a form: an
 * officer reviews and corrects every field before it is used.
 *
 * Providers (ATTRIBUTE_EXTRACTION_PROVIDER):
 * - "ollama" (default): a free local model served by Ollama on this machine
 *   (OLLAMA_URL, OLLAMA_VISION_MODEL). Photos never leave the computer.
 * - "anthropic": Claude through Anthropic's API (needs ANTHROPIC_API_KEY).
 *   Used automatically when ANTHROPIC_API_KEY is set and no provider is named.
 * Scan photos are not stored by DMEWS.
 */
const AnthropicModule = require("@anthropic-ai/sdk");
const sharp = require("sharp");

const Anthropic = AnthropicModule.default || AnthropicModule;
const HAS_ANTHROPIC_KEY = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const PROVIDER = (process.env.ATTRIBUTE_EXTRACTION_PROVIDER || (HAS_ANTHROPIC_KEY ? "anthropic" : "ollama")).toLowerCase();
const CLAUDE_MODEL = process.env.ATTRIBUTE_EXTRACTION_MODEL || "claude-opus-5-5";
const OLLAMA_URL = String(process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:7b";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 300_000;
// Claude handles up to ~1568px; local models are much faster on smaller images.
const MAX_IMAGE_EDGE = PROVIDER === "anthropic" ? 1568 : 1024;

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function isExtractionConfigured() {
  return PROVIDER === "anthropic" ? HAS_ANTHROPIC_KEY : PROVIDER === "ollama";
}

const nullableInteger = { anyOf: [{ type: "integer" }, { type: "null" }] };

const MARK = {
  type: "object",
  additionalProperties: false,
  required: ["bodyLocation", "description", "visibleText"],
  properties: {
    bodyLocation: {
      type: "string",
      description: "Where on the body, using the subject's own left/right, e.g. 'left forearm, inner side'.",
    },
    description: { type: "string", description: "Shape, size, colour, design and condition, as precisely as visible." },
    visibleText: { type: "string", description: "Any letters or numbers in the mark, copied exactly; empty if none." },
  },
};

const ITEM = {
  type: "object",
  additionalProperties: false,
  required: ["item", "color", "bodyLocation", "description"],
  properties: {
    item: { type: "string", description: "e.g. 'T-shirt', 'ring', 'wristwatch', 'sarong'." },
    color: { type: "string" },
    bodyLocation: { type: "string", description: "Where it is worn or found; empty if not applicable." },
    description: { type: "string", description: "Pattern, brand, logo, printed text, material, condition." },
  },
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "faceVisibility", "estimatedAgeMin", "estimatedAgeMax", "sex", "build", "skinTone",
    "hairColor", "hairLength", "facialHair", "tattoos", "scars", "birthmarks", "piercings",
    "otherMarks", "clothing", "jewellery", "personalItems", "visibleText", "summary", "uncertainties",
  ],
  properties: {
    faceVisibility: { type: "string", enum: ["clear", "partial", "not_visible"] },
    estimatedAgeMin: nullableInteger,
    estimatedAgeMax: nullableInteger,
    sex: { type: "string", enum: ["male", "female", "unknown"] },
    build: { type: "string", enum: ["slim", "medium", "heavy", "unknown"] },
    skinTone: { type: "string" },
    hairColor: { type: "string" },
    hairLength: { type: "string", enum: ["bald", "short", "medium", "long", "unknown"] },
    facialHair: { type: "string", description: "e.g. 'none', 'moustache', 'full beard'." },
    tattoos: { type: "array", items: MARK },
    scars: { type: "array", items: MARK },
    birthmarks: { type: "array", items: MARK },
    piercings: { type: "array", items: MARK },
    otherMarks: {
      type: "array",
      items: MARK,
      description: "Moles, missing fingers, dental features, medical devices, other distinguishing features.",
    },
    clothing: { type: "array", items: ITEM },
    jewellery: { type: "array", items: ITEM },
    personalItems: { type: "array", items: ITEM, description: "Glasses, watch, bag, phone, documents, other belongings." },
    visibleText: {
      type: "array",
      items: { type: "string" },
      description: "Every piece of readable text on the body, clothing or items.",
    },
    summary: { type: "string", description: "Two or three sentences describing the person for a search record." },
    uncertainties: { type: "string", description: "What could not be determined and why; empty if nothing." },
  },
};

// Small local models tend to repeat themselves inside long free-text fields
// until they hit the output limit, so the local schema leaves those out; the
// officer writes the summary in the review form.
const LOCAL_FREE_TEXT = ["summary", "uncertainties"];
const LOCAL_SCHEMA = {
  ...SCHEMA,
  required: SCHEMA.required.filter((key) => !LOCAL_FREE_TEXT.includes(key)),
  properties: Object.fromEntries(Object.entries(SCHEMA.properties).filter(([key]) => !LOCAL_FREE_TEXT.includes(key))),
};

const SYSTEM_PROMPT = `You assist disaster victim identification officers in Sri Lanka by describing the physical features visible in photos of a person, so the details can be compared with missing-person reports.

Rules:
- Describe only what is visible in the photos. Do not guess identity, names, ethnicity, religion, or cause of death.
- All photos show the same person. Combine what each photo shows (for example a face photo plus tattoo close-ups).
- Be precise about distinguishing marks: tattoos (design, colours, any text copied exactly), scars, birthmarks, piercings. These matter most for identification.
- Use the subject's own left and right for body locations.
- Give an age range only when the photos support one; otherwise use null. Use "unknown" or an empty list when a feature cannot be seen.
- Injuries or damage that change appearance should be mentioned in uncertainties, without graphic detail.
- If no person is visible, return empty lists and "unknown" values and explain in uncertainties.`;

async function prepareImage(buffer) {
  const data = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return data.toString("base64");
}

async function extractWithClaude(encoded) {
  const content = [];
  encoded.forEach((data, index) => {
    content.push({ type: "text", text: `Photo ${index + 1} of ${encoded.length}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  });
  content.push({ type: "text", text: "Describe this person's identifying features using the required format." });

  const response = await getClient().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    return {
      status: "refused",
      model: response.model,
      error: "The AI declined to describe these photos. Fill in the details manually.",
    };
  }
  if (response.stop_reason === "max_tokens") {
    return { status: "error", model: response.model, error: "The AI response was cut off. Try again." };
  }
  const text = response.content.find((block) => block.type === "text")?.text || "";
  return { status: "ok", model: response.model, attributes: JSON.parse(text) };
}

async function extractWithOllama(encoded) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: LOCAL_SCHEMA,
        options: { temperature: 0, num_predict: 1024 },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${encoded.length} photo(s) of the same person are attached, in order. Describe this person's identifying features as JSON in the required format.`,
            images: encoded,
          },
        ],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data.error || `Ollama returned ${response.status}.`);
      throw new Error(
        /not found|pull/i.test(detail) ? `Model ${OLLAMA_MODEL} is not downloaded. Run: ollama pull ${OLLAMA_MODEL}` : detail
      );
    }
    if (data.done_reason === "length") {
      return { status: "error", model: OLLAMA_MODEL, error: "The AI response was cut off. Try again." };
    }
    return { status: "ok", model: OLLAMA_MODEL, attributes: JSON.parse(data.message?.content || "") };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {Array<{buffer: Buffer}>} images
 * @returns {Promise<{status: "ok"|"refused"|"error"|"unavailable", model?: string, attributes?: object, error?: string}>}
 */
async function extractAttributes(images) {
  if (!isExtractionConfigured()) {
    return {
      status: "unavailable",
      error: PROVIDER === "anthropic"
        ? "ANTHROPIC_API_KEY is not set on the backend."
        : `Unknown ATTRIBUTE_EXTRACTION_PROVIDER "${PROVIDER}".`,
    };
  }
  try {
    const encoded = await Promise.all(images.map((image) => prepareImage(image.buffer)));
    return PROVIDER === "anthropic" ? await extractWithClaude(encoded) : await extractWithOllama(encoded);
  } catch (error) {
    const code = error?.cause?.code || error?.code;
    let message = error?.message || "Attribute extraction failed.";
    if (error?.name === "AbortError") message = "The local AI model took too long. Try fewer photos.";
    else if (code === "ECONNREFUSED") message = `The local AI (Ollama) is not running at ${OLLAMA_URL}. Start it with: ollama serve`;
    else if (error instanceof Anthropic.AuthenticationError) message = "ANTHROPIC_API_KEY was rejected.";
    else if (error instanceof Anthropic.RateLimitError) message = "AI rate limit reached. Try again shortly.";
    else if (error instanceof SyntaxError) message = "The AI returned an unreadable response.";
    return { status: "error", error: String(message).slice(0, 300) };
  }
}

module.exports = { extractAttributes, isExtractionConfigured, EXTRACTION_PROVIDER: PROVIDER };
