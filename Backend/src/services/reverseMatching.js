/**
 * Reverse matching: when a missing-person report is created or edited, check
 * it against every open victim scan. A report that would have been suggested
 * for a scan is added to that scan's suggestions (decision "pending", marked
 * as new) so admins see it on their next review.
 *
 * Runs in the background after the report is saved; failures are logged and
 * never affect the reporter.
 */
const { MissingPerson } = require("../models/MissingPerson");
const { VictimIdentificationScan } = require("../models/VictimIdentificationScan");
const { audit } = require("../models/VictimScanAudit");
const { rankCandidates } = require("./matching");

const MAX_SUGGESTIONS = 20;
const SYSTEM = { userId: "system", authEmail: "reverse matching" };

const CANDIDATE_FIELDS =
  "fullName age gender lastSeenLocation location dateMissing description identifyingFeatures photoUrl face.status +face.embedding textIndex.status +textIndex.items";

/**
 * @param {string} personId
 * @returns {Promise<{checked: number, added: number}>}
 */
async function checkReportAgainstOpenScans(personId) {
  const person = await MissingPerson.findById(personId).select(CANDIDATE_FIELDS).lean().exec();
  if (!person) return { checked: 0, added: 0 };

  const scans = await VictimIdentificationScan.find({ status: "completed", caseStatus: "open" })
    .select("+face.embedding")
    .exec();
  let added = 0;
  for (const scan of scans) {
    const already = scan.matches.find((m) => String(m.personId) === String(person._id));
    if (already) continue;
    const result = await rankCandidates(
      {
        faceEmbedding: scan.face?.status === "ok" ? scan.face.embedding : null,
        details: scan.details || {},
        foundPoint: scan.foundPoint?.length === 2 ? scan.foundPoint : null,
      },
      [person]
    );
    const match = result.matches[0];
    if (!match) continue;
    if (scan.matches.length >= MAX_SUGGESTIONS) {
      console.warn(`Reverse matching: scan ${scan._id} already has ${MAX_SUGGESTIONS} suggestions; skipped ${person._id}.`);
      continue;
    }
    scan.matches.push({ ...match, source: "new_report", addedAt: new Date() });
    scan.matches.sort((a, b) => (b.score || 0) - (a.score || 0));
    scan.newMatchCount = (scan.newMatchCount || 0) + 1;
    await scan.save();
    await audit(SYSTEM, scan._id, "match_added", { personId: person._id, note: `New report "${person.fullName}", score ${match.score}` });
    added += 1;
  }
  return { checked: scans.length, added };
}

/** Fire-and-forget wrapper for request handlers. */
function checkReportInBackground(personId) {
  setImmediate(() => {
    checkReportAgainstOpenScans(personId)
      .then(({ checked, added }) => {
        if (added) console.log(`Reverse matching: report ${personId} added to ${added} of ${checked} open scan(s).`);
      })
      .catch((error) => console.error("Reverse matching failed", { personId: String(personId), error: error?.message }));
  });
}

module.exports = { checkReportAgainstOpenScans, checkReportInBackground };
