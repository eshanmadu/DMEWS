const mongoose = require("mongoose");

const { Schema } = mongoose;

/**
 * Record of everything done to a victim identification scan: creation,
 * detail confirmation, photo views, match decisions, photo deletion.
 * Entries are never edited. When a case is deleted, its entries are deleted
 * with it and a single "case_deleted" entry (who, when, reason; no personal
 * details) is kept.
 */
const VictimScanAuditSchema = new Schema(
  {
    scanId: { type: Schema.Types.ObjectId, ref: "VictimIdentificationScan", required: true, index: true },
    /** String so the dev-admin session (not a database user) can be recorded too. */
    userId: { type: String, required: true },
    userEmail: { type: String, default: "" },
    action: {
      type: String,
      required: true,
      enum: [
        "scan_created",
        "details_confirmed",
        "photo_viewed",
        "match_confirmed",
        "match_rejected",
        "match_needs_verification",
        "match_reset",
        "match_added",
        "case_closed",
        "photos_deleted",
        "case_deleted",
      ],
    },
    personId: { type: Schema.Types.ObjectId, ref: "MissingPerson", default: null },
    note: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const VictimScanAudit =
  mongoose.models.VictimScanAudit || mongoose.model("VictimScanAudit", VictimScanAuditSchema);

/** Record an action; failures are logged, never thrown, so they can't block the work. */
async function audit(req, scanId, action, extra = {}) {
  try {
    await VictimScanAudit.create({
      scanId,
      userId: String(req.userId || "unknown"),
      userEmail: String(req.authEmail || ""),
      action,
      personId: extra.personId || null,
      note: String(extra.note || "").slice(0, 1000),
    });
  } catch (error) {
    console.error("Victim scan audit write failed", { scanId: String(scanId), action, error: error?.message });
  }
}

module.exports = { VictimScanAudit, audit };
