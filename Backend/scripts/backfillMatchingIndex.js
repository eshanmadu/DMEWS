/**
 * Prepare existing missing-person records for victim identification matching:
 * - face encoding of the photo (needs the Python face service), and
 * - text index of the description (needs Ollama with nomic-embed-text).
 *
 *   node scripts/backfillMatchingIndex.js            # only what is missing, failed or out of date
 *   node scripts/backfillMatchingIndex.js --all      # recompute everything
 *   node scripts/backfillMatchingIndex.js --dry-run  # list what would be processed
 *
 * Needs MONGODB_URI and FACE_RECOGNITION_URL in Backend/.env. Safe to re-run.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../src/db");
const { MissingPerson } = require("../src/models/MissingPerson");
const { computeFace, downloadImage, isFaceServiceConfigured } = require("../src/services/faceService");
const { buildTextIndex, indexHash } = require("../src/services/matching");

const args = new Set(process.argv.slice(2));
const ALL = args.has("--all");
const DRY_RUN = args.has("--dry-run");

function needsFace(person) {
  if (!person.photoUrl) return false;
  return ALL || !person.face?.status || person.face.status === "error" || person.face.photoUrl !== person.photoUrl;
}

function needsText(person) {
  return ALL || person.textIndex?.status !== "ok" || person.textIndex?.sourceHash !== indexHash(person);
}

async function run() {
  const faceReady = isFaceServiceConfigured()
    && (await fetch(`${process.env.FACE_RECOGNITION_URL.replace(/\/+$/, "")}/health`).then((r) => r.json()).catch(() => null))
      ?.faceRecognitionConfigured;
  if (!faceReady) console.warn("Face service not reachable: face encodings will be skipped this run.");

  await connectDb();
  const people = await MissingPerson.find({})
    .select("_id fullName photoUrl description face.status face.photoUrl textIndex.status textIndex.sourceHash")
    .lean()
    .exec();
  const todo = people.filter((p) => (faceReady && needsFace(p)) || needsText(p));
  console.log(`${people.length} record(s); ${todo.length} to process${DRY_RUN ? " (dry run)" : ""}.`);

  const totals = { face: {}, text: {} };
  const count = (kind, status) => { totals[kind][status] = (totals[kind][status] || 0) + 1; };
  for (const [index, person] of todo.entries()) {
    const label = `[${index + 1}/${todo.length}] ${person._id} ${person.fullName}`;
    const doFace = faceReady && needsFace(person);
    const doText = needsText(person);
    if (DRY_RUN) {
      console.log(`${label}: ${[doFace && "face", doText && "text"].filter(Boolean).join(" + ")}`);
      continue;
    }
    const update = {};
    if (doFace) {
      try {
        const image = await downloadImage(person.photoUrl);
        update.face = await computeFace(image.buffer, image.mimetype, person.photoUrl);
      } catch (error) {
        update.face = { status: "error", error: String(error?.message || error).slice(0, 300), photoUrl: person.photoUrl, computedAt: new Date() };
      }
      count("face", update.face.status);
    }
    if (doText) {
      update.textIndex = await buildTextIndex(person);
      count("text", update.textIndex.status);
    }
    await MissingPerson.updateOne({ _id: person._id }, { $set: update }).exec();
    const parts = [
      update.face && `face=${update.face.status}${update.face.error ? ` (${update.face.error})` : ""}`,
      update.textIndex && `text=${update.textIndex.status} (${update.textIndex.items.length} statements)${update.textIndex.error ? ` ${update.textIndex.error}` : ""}`,
    ].filter(Boolean);
    console.log(`${label}: ${parts.join(", ")}`);
  }
  if (!DRY_RUN) console.log("Done.", JSON.stringify(totals));
}

run()
  .catch((error) => {
    console.error("Matching backfill failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
