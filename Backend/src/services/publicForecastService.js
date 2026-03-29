let publicForecastCache = { ts: 0, text: "" };
let meteoSlMapCache = { ts: 0, url: "" };

const FIRECRAWL_API_KEY =
  process.env.FIRECRAWL_API_KEY || "fc-dccca603b3184027b68e4aaaf408cb7d";

const SOURCE_URL = "https://meteo.gov.lk/";

/** 24-hour SL map (fallback if Firecrawl parse misses it) — matches ![24 Hour Map](https://meteo.gov.lk/images/SLMap.jpg?...) */
const DEFAULT_SL_MAP_URL = "https://meteo.gov.lk/images/SLMap.jpg";

function extractSlMapUrlFromMarkdown(markdown) {
  if (!markdown || typeof markdown !== "string") return null;
  // e.g. ![24 Hour Map](https://meteo.gov.lk/images/SLMap.jpg?v=1774368547)
  const mdImg = markdown.match(
    /!\[[^\]]*]\((https?:\/\/[^)\s]+SLMap\.jpg(?:\?[^)\s]*)?)\)/i
  );
  if (mdImg?.[1]) return mdImg[1].trim();
  const abs = markdown.match(
    /(https?:\/\/meteo\.gov\.lk\/images\/SLMap\.jpg(?:\?[^\s)"']*)?)/i
  );
  if (abs?.[1]) return abs[1].trim();
  const rel = markdown.match(/\]\((\/images\/SLMap\.jpg(?:\?[^)\s]*)?)\)/i);
  if (rel?.[1]) return `https://meteo.gov.lk${rel[1]}`;
  // legacy root path (older site)
  const legacy = markdown.match(
    /(https?:\/\/meteo\.gov\.lk\/SL_Map\.jpg(?:\?[^\s)"']*)?)/i
  );
  if (legacy?.[1]) return legacy[1].trim();
  return null;
}

async function fetchMeteoSlMapUrlFromFirecrawl() {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }

  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: SOURCE_URL,
      formats: ["markdown"],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(
      `Firecrawl error ${resp.status}: ${txt.slice(0, 200) || "no body"}`
    );
  }

  const json = await resp.json();
  const markdown = json?.data?.markdown || "";
  const extracted = extractSlMapUrlFromMarkdown(markdown);
  const url = extracted || DEFAULT_SL_MAP_URL;
  meteoSlMapCache = { ts: Date.now(), url };
  return url;
}

async function getMeteoSlMapImageUrl() {
  const ttlMs = 6 * 60 * 60 * 1000; // 6 hours
  if (
    meteoSlMapCache.url &&
    Date.now() - meteoSlMapCache.ts < ttlMs
  ) {
    return meteoSlMapCache.url;
  }
  return fetchMeteoSlMapUrlFromFirecrawl();
}

async function fetchPublicForecastFromFirecrawl() {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }

  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: SOURCE_URL,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(
      `Firecrawl error ${resp.status}: ${txt.slice(0, 200) || "no body"}`
    );
  }

  const json = await resp.json();
  const markdown = json?.data?.markdown || "";

  let text = markdown || "";

  const lower = markdown.toLowerCase();
  const marker = "public weather forecast";
  const idx = lower.indexOf(marker);
  if (idx !== -1) {
    let section = markdown.slice(idx);
    // Do not cut at the first "##" — meteo.gov.lk markdown often inserts "##"
    // between language blocks, which would leave only one line of Tamil.

    const onlineIdx = section.toLowerCase().indexOf("online users");
    if (onlineIdx !== -1) {
      section = section.slice(0, onlineIdx);
    }

    const MAX_CHARS = 12000;
    if (section.length > MAX_CHARS) {
      section = section.slice(0, MAX_CHARS);
    }

    const paragraphs = section
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length);
    if (paragraphs.length > 0) {
      // Keep full trilingual block (Sinhala, English, Tamil), not just the first few paragraphs.
      text = paragraphs.join("\n\n").trim();
    } else {
      text = section.trim();
    }
  }

  const stopMatch = text.match(/([\s\S]*?)Online Users\s*:\s*\d+/i);
  if (stopMatch) {
    text = stopMatch[1].trim();
  }

  publicForecastCache = { ts: Date.now(), text };
  return text;
}

async function getPublicForecastText() {
  const ttlMs = 24 * 60 * 60 * 1000; // 24 hours
  if (
    publicForecastCache.text &&
    Date.now() - publicForecastCache.ts < ttlMs
  ) {
    return publicForecastCache.text;
  }

  return fetchPublicForecastFromFirecrawl();
}

module.exports = {
  getPublicForecastText,
  getMeteoSlMapImageUrl,
  DEFAULT_SL_MAP_URL,
};

