import { NextResponse } from "next/server";

const FIRECRAWL_API_KEY =
  process.env.FIRECRAWL_API_KEY ||
  "fc-dccca603b3184027b68e4aaaf408cb7d";

const SOURCE_URL = "https://meteo.gov.lk/";

export async function GET() {
  if (!FIRECRAWL_API_KEY) {
    return NextResponse.json(
      { error: "Firecrawl API key is not configured." },
      { status: 500 }
    );
  }

  try {
    // Use Firecrawl legacy v1 scrape endpoint with simple body.
    // This returns { success, data: { markdown, ... } }.
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
      const text = await resp.text();
      console.error("Firecrawl error:", resp.status, text);
      return NextResponse.json(
        {
          error: "Failed to fetch forecast text from Firecrawl.",
          status: resp.status,
        },
        { status: 502 }
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
      // Same as backend: avoid cutting at "##" between Sinhala/English/Tamil blocks.

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
        text = paragraphs.join("\n\n").trim();
      } else {
        text = section.trim();
      }
    }

    // Final safety: if "Online Users" still appears anywhere, cut it off.
    const stopMatch = text.match(/([\s\S]*?)Online Users\s*:\s*\d+/i);
    if (stopMatch) {
      text = stopMatch[1].trim();
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Public forecast route error:", err);
    return NextResponse.json(
      { error: "Unexpected error while loading forecast text." },
      { status: 500 }
    );
  }
}

