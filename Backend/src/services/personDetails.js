/**
 * Shared description of a person's identifying features, used by:
 * - victim scans (officer-confirmed `details`), and
 * - public missing-person reports (`identifyingFeatures`).
 * Both sides use the same shape and the same sentence phrasing, so matching
 * compares like with like.
 */

const MARK_KINDS = {
  tattoos: "tattoo",
  scars: "scar",
  birthmarks: "birthmark",
  piercings: "piercing",
  otherMarks: "distinguishing feature",
};
const ITEM_KINDS = { clothing: "clothing", jewellery: "jewellery", personalItems: "personal item" };
const SEX = ["male", "female", "unknown"];
const BUILD = ["slim", "medium", "heavy", "unknown"];
const HAIR_LENGTH = ["bald", "short", "medium", "long", "unknown"];

const text = (value, max = 300) => String(value ?? "").trim().slice(0, max);
const oneOf = (value, allowed) =>
  allowed.includes(String(value || "").toLowerCase()) ? String(value).toLowerCase() : "unknown";

function age(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 120 ? n : null;
}

function objects(value, mapItem, max = 30) {
  return (Array.isArray(value) ? value : [])
    .slice(0, max)
    .map(mapItem)
    .filter((item) => Object.values(item).some(Boolean));
}

function strings(value, max = 30) {
  return (Array.isArray(value) ? value : []).slice(0, max).map((v) => text(v, 200)).filter(Boolean);
}

/** Marks, items and readable text: the part both sides share. */
function cleanFeatures(raw = {}) {
  const features = { visibleText: strings(raw.visibleText) };
  for (const key of Object.keys(MARK_KINDS)) {
    features[key] = objects(raw[key], (m) => ({
      bodyLocation: text(m?.bodyLocation, 200),
      description: text(m?.description, 500),
      visibleText: text(m?.visibleText, 200),
    }));
  }
  for (const key of Object.keys(ITEM_KINDS)) {
    features[key] = objects(raw[key], (i) => ({
      item: text(i?.item, 100),
      color: text(i?.color, 100),
      bodyLocation: text(i?.bodyLocation, 200),
      description: text(i?.description, 500),
    }));
  }
  return features;
}

/** Full officer-reviewed description of a scanned person. */
function cleanDetails(raw = {}) {
  let ageMin = age(raw.estimatedAgeMin);
  let ageMax = age(raw.estimatedAgeMax);
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  return {
    foundLocation: text(raw.foundLocation, 500),
    foundDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.foundDate || "")) ? String(raw.foundDate) : "",
    estimatedAgeMin: ageMin,
    estimatedAgeMax: ageMax,
    sex: oneOf(raw.sex, SEX),
    build: oneOf(raw.build, BUILD),
    skinTone: text(raw.skinTone, 100),
    hairColor: text(raw.hairColor, 100),
    hairLength: oneOf(raw.hairLength, HAIR_LENGTH),
    facialHair: text(raw.facialHair, 100),
    summary: text(raw.summary, 1000),
    notes: text(raw.notes, 1000),
    ...cleanFeatures(raw),
  };
}

/**
 * One sentence per mark or item, e.g. 'tattoo on left forearm: rose with text "Amma"'.
 * @returns {Array<{group: "marks"|"items", key: string, word: string, text: string, label: string}>}
 */
function featureStatements(features = {}) {
  const statements = [];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  for (const [key, word] of Object.entries(MARK_KINDS)) {
    for (const mark of features[key] || []) {
      const where = mark.bodyLocation ? ` on ${mark.bodyLocation}` : "";
      const words = mark.visibleText ? ` with text "${mark.visibleText}"` : "";
      statements.push({ group: "marks", key, word, text: `${word}${where}: ${mark.description || ""}${words}`.trim(), label: `${cap(word)}${where}` });
    }
  }
  for (const [key, word] of Object.entries(ITEM_KINDS)) {
    for (const item of features[key] || []) {
      const body = [item.color, item.item, item.description, item.bodyLocation && `on ${item.bodyLocation}`].filter(Boolean).join(" ");
      if (!body) continue;
      statements.push({ group: "items", key, word, text: `${word}: ${body}`, label: `${cap(word)}: ${[item.color, item.item].filter(Boolean).join(" ")}` });
    }
  }
  return statements;
}

/** Every readable word in the features (tattoo text, printed names). */
function featureWords(features = {}) {
  const words = new Set();
  const add = (value) =>
    String(value || "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3)
      .forEach((w) => words.add(w.toLowerCase()));
  (features.visibleText || []).forEach(add);
  for (const key of Object.keys(MARK_KINDS)) (features[key] || []).forEach((m) => add(m.visibleText));
  return [...words];
}

function hasFeatures(features = {}) {
  return featureStatements(features).length > 0 || (features.visibleText || []).length > 0;
}

module.exports = { MARK_KINDS, ITEM_KINDS, text, cleanDetails, cleanFeatures, featureStatements, featureWords, hasFeatures };
