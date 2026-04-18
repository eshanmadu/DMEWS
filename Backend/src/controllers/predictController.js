const { connectDb } = require("../db");
const { RiskPrediction } = require("../models/RiskPrediction");
const { SRI_LANKA_DISTRICTS } = require("../constants/sriLankaDistricts");

function startOfUtcHour(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), x.getUTCHours()));
}

function riskRank(level) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  if (level === "low") return 1;
  return 0;
}

function parseRangeMs(rangeRaw) {
  const s = String(rangeRaw || "").trim().toLowerCase();
  if (s === "6h") return 6 * 60 * 60 * 1000;
  if (s === "24h" || s === "1d") return 24 * 60 * 60 * 1000;
  if (s === "7d") return 7 * 24 * 60 * 60 * 1000;
  return null;
}

function pickPeakRow(rows) {
  if (!rows || rows.length === 0) return null;
  return rows.reduce((best, cur) => {
    const br = riskRank(best.level);
    const cr = riskRank(cur.level);
    if (cr > br) return cur;
    if (cr < br) return best;
    const bt = new Date(best.date).getTime();
    const ct = new Date(cur.date).getTime();
    return ct >= bt ? cur : best;
  });
}

/**
 * GET /api/predict?range=6h|24h|7d
 * Returns exactly 25 rows — one per district — peak risk within the window (latest tie-break).
 */
async function getPredictAggregate(req, res) {
  try {
    await connectDb();

    const rangeParam = req.query?.range;
    const ms = parseRangeMs(rangeParam);
    if (!ms) {
      return res.status(400).json({
        message: "Invalid or missing range. Use one of: 6h, 24h, 7d",
      });
    }

    const from = startOfUtcHour(new Date());
    const to = new Date(from.getTime() + ms);

    const rows = await RiskPrediction.find({
      date: { $gte: from, $lt: to },
    })
      .sort({ district: 1, date: 1 })
      .lean()
      .exec();

    const byDistrict = new Map();
    for (const r of rows) {
      const d = String(r.district || "").trim();
      if (!d) continue;
      if (!byDistrict.has(d)) byDistrict.set(d, []);
      byDistrict.get(d).push(r);
    }

    const rangeLabel =
      ms === 6 * 60 * 60 * 1000 ? "6h" : ms === 24 * 60 * 60 * 1000 ? "24h" : "7d";

    const payload = SRI_LANKA_DISTRICTS.map((district) => {
      const list = byDistrict.get(district) || [];
      const peak = pickPeakRow(list);
      if (!peak) {
        return {
          district,
          level: "safe",
          confidence: 0,
          peakAt: null,
          source: "",
          range: rangeLabel,
          windowStart: from.toISOString(),
          windowEnd: to.toISOString(),
          hasData: false,
        };
      }
      return {
        district,
        level: peak.level,
        confidence: peak.confidence ?? 0,
        peakAt: peak.date,
        source: peak.source || "",
        range: rangeLabel,
        windowStart: from.toISOString(),
        windowEnd: to.toISOString(),
        hasData: true,
        id: peak._id.toString(),
      };
    });

    return res.json(payload);
  } catch (error) {
    console.error("Predict aggregate error", error);
    return res.status(500).json({ message: "Failed to load district predictions." });
  }
}

module.exports = { getPredictAggregate };
