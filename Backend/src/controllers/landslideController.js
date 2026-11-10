const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const DMC_LANDSLIDE_REPORTS_URL =
  "https://www.dmc.gov.lk/index.php?option=com_dmcreports&view=reports&Itemid=276&report_type_id=5&lang=en";
const DMC_ORIGIN = "https://www.dmc.gov.lk";

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseReports(html) {
  const reports = [];
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const linkMatch = row.match(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/i);
    if (!linkMatch) continue;

    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
      stripHtml(match[1])
    );
    const date = cells.find((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)) || null;
    const time = cells.find((value) => /^\d{1,2}:\d{2}$/.test(value)) || null;
    const title = cells.find((value) => /landslide/i.test(value)) || "Landslide warning";

    reports.push({
      title,
      date,
      time,
      url: new URL(linkMatch[1], DMC_ORIGIN).toString(),
    });
  }

  return reports;
}

function runExtractor(pdfPath) {
  const command = process.env.LANDSLIDE_PYTHON_COMMAND || "python";
  const scriptPath = path.join(__dirname, "../../scripts/extract_landslide_report.py");

  return new Promise((resolve, reject) => {
    const child = spawn(command, [scriptPath, pdfPath], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Landslide extractor exited with ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Landslide extractor returned invalid JSON."));
      }
    });
  });
}

async function getLandslideWarnings(_req, res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(DMC_LANDSLIDE_REPORTS_URL, {
      signal: controller.signal,
      headers: { "User-Agent": "DMEWS landslide warnings reader" },
    });
    if (!response.ok) {
      throw new Error(`DMC returned HTTP ${response.status}`);
    }

    const reports = parseReports(await response.text());
    const latest = reports[0];
    if (!latest) throw new Error("DMC report list contains no PDF reports.");

    const pdfResponse = await fetch(latest.url, {
      signal: controller.signal,
      headers: { "User-Agent": "DMEWS landslide warnings reader" },
    });
    if (!pdfResponse.ok) throw new Error(`DMC PDF returned HTTP ${pdfResponse.status}`);

    const pdfPath = path.join(os.tmpdir(), `dmews-landslide-${crypto.randomUUID()}.pdf`);
    await fs.writeFile(pdfPath, Buffer.from(await pdfResponse.arrayBuffer()));
    let extracted;
    try {
      extracted = await runExtractor(pdfPath);
    } finally {
      await fs.unlink(pdfPath).catch(() => {});
    }

    res.json({
      source: DMC_LANDSLIDE_REPORTS_URL,
      fetchedAt: new Date().toISOString(),
      report: {
        ...latest,
        messageId: extracted.messageId,
        validity: extracted.validity,
        extractionMethod: extracted.extractionMethod,
      },
      warnings: extracted.warnings,
    });
  } catch (error) {
    console.error("Failed to load DMC landslide warnings", error);
    res.status(502).json({
      message: "The official DMC landslide warning feed is currently unavailable.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { getLandslideWarnings };
