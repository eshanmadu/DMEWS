// Seed dummy risk predictions for next N days.
// Usage: node scripts/seedRiskPredictions.js [days=30]

const dotenv = require("dotenv");
dotenv.config();

const { connectDb } = require("../src/db");
const { RiskPrediction } = require("../src/models/RiskPrediction");
const { RiskLevel } = require("../src/models/RiskLevel");

const DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

function startOfUtcDay(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickLevelFromIndex(idx) {
  return idx <= 0 ? "safe" : idx === 1 ? "low" : idx === 2 ? "medium" : "high";
}

function levelToIndex(level) {
  return level === "high" ? 3 : level === "medium" ? 2 : level === "low" ? 1 : 0;
}

function jitterLevel(baseIdx, dayOffset) {
  // deterministic-ish trend + randomness
  const wave = Math.sin((dayOffset / 6) * Math.PI) * 0.9;
  const rand = (Math.random() - 0.5) * 1.2;
  const n = Math.round(baseIdx + wave + rand);
  return clamp(n, 0, 3);
}

async function main() {
  const daysArg = parseInt(process.argv[2] || "30", 10);
  const days = Number.isFinite(daysArg) ? clamp(daysArg, 1, 60) : 30;

  await connectDb();

  // Use existing admin-set levels as a base signal (optional).
  const current = await RiskLevel.find({}).lean().exec();
  const baseMap = new Map();
  for (const r of current) {
    if (r?.district) baseMap.set(String(r.district).trim(), String(r.level || "safe"));
  }

  const today = startOfUtcDay(new Date());

  const ops = [];
  const preview = [];
  for (const district of DISTRICTS) {
    const baseLevel = baseMap.get(district) || "safe";
    const baseIdx = levelToIndex(baseLevel);

    for (let i = 0; i < days; i += 1) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const idx = jitterLevel(baseIdx, i);
      const level = pickLevelFromIndex(idx);

      // confidence: higher when close to base, lower when drifting
      const drift = Math.abs(idx - baseIdx);
      const confidence = clamp(0.9 - drift * 0.18 + (Math.random() - 0.5) * 0.08, 0.35, 0.95);

      const doc = {
        district,
        date,
        level,
        confidence,
        source: "Novelty seed (dummy 30-day forecast)",
      };
      ops.push({
        updateOne: {
          filter: { district, date },
          update: { $set: doc },
          upsert: true,
        },
      });
      if (district === DISTRICTS[0] && i < 5) {
        preview.push({
          district: doc.district,
          date: doc.date.toISOString().slice(0, 10),
          level: doc.level,
          confidence: Number(doc.confidence.toFixed(2)),
        });
      }
    }
  }

  if (ops.length > 0) {
    await RiskPrediction.bulkWrite(ops, { ordered: false });
  }

  console.log("Seed preview (first 5 rows for Colombo):");
  console.table(preview);
  console.log(`Seeded/updated ${ops.length} risk predictions (${DISTRICTS.length} districts × ${days} days).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed risk predictions failed", err);
  process.exit(1);
});

