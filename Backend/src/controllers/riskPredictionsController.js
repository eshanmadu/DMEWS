const { connectDb } = require("../db");
const { RiskPrediction } = require("../models/RiskPrediction");

function parseIntSafe(v, fallback) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function startOfUtcDay(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function startOfUtcHour(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), x.getUTCHours()));
}

async function listRiskPredictions(req, res) {
  try {
    await connectDb();

    const district = String(req.query?.district || "").trim();
    const window = String(req.query?.window || "").trim(); // 6h | 1d | 7d
    const fromRaw = String(req.query?.from || "").trim(); // YYYY-MM-DD

    const now = startOfUtcHour(new Date());
    const from = fromRaw ? startOfUtcDay(new Date(`${fromRaw}T00:00:00.000Z`)) : now;

    let to;
    if (window === "6h") {
      to = new Date(from.getTime() + 6 * 60 * 60 * 1000);
    } else if (window === "1d") {
      to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    } else if (window === "7d") {
      to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      // Backward-compatible fallback (older UI with days param)
      const days = Math.min(60, Math.max(1, parseIntSafe(req.query?.days, 30)));
      to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
    }

    const q = { date: { $gte: from, $lt: to } };
    if (district) q.district = district;

    const rows = await RiskPrediction.find(q)
      .sort({ date: 1, district: 1 })
      .lean()
      .exec();

    return res.json(
      rows.map((r) => ({
        id: r._id.toString(),
        district: r.district,
        date: r.date,
        level: r.level,
        confidence: r.confidence,
        source: r.source || "",
        createdAt: r.createdAt,
      }))
    );
  } catch (error) {
    console.error("Risk predictions list error", error);
    return res.status(500).json({ message: "Failed to load risk predictions." });
  }
}

module.exports = { listRiskPredictions };

