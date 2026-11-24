const mongoose = require("mongoose");

const { Schema } = mongoose;

/**
 * One victim identification scan.
 *
 * Lifecycle: "draft" (photos analysed, AI details awaiting officer review)
 * -> "completed" (officer confirmed details, matching ran)
 * -> reviewed by an admin: caseStatus "open" -> "identified" -> "closed".
 * Photos are stored encrypted on the backend disk (services/scanPhotoStore.js)
 * and deleted when the case is closed or the retention period ends.
 */
const VictimIdentificationScanSchema = new Schema(
  {
    officerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["draft", "processing", "completed", "unavailable", "failed"], required: true },
    imageCount: { type: Number, min: 0, default: 0 },
    /** Encrypted photos on disk; empty once deleted (photosDeletedAt set). */
    photos: [{
      _id: false,
      index: { type: Number, required: true },
      mimetype: { type: String, default: "image/jpeg" },
      bytes: { type: Number },
      storedAt: { type: Date },
    }],
    photosDeletedAt: { type: Date },

    /** Admin review of the suggested matches. */
    caseStatus: { type: String, enum: ["open", "identified", "closed"], default: "open", index: true },
    identifiedPersonId: { type: Schema.Types.ObjectId, ref: "MissingPerson", default: null },
    closedAt: { type: Date },
    closeNote: { type: String, trim: true, maxlength: 1000, default: "" },

    /** Face encoding of the best face photo (embedding hidden unless selected). */
    face: {
      status: { type: String, enum: ["ok", "no_face", "multiple_faces", "error"] },
      embedding: { type: [Number], default: undefined, select: false },
      imageIndex: { type: Number },
      faceCount: { type: Number },
      quality: { type: Schema.Types.Mixed },
      estimatedAge: { type: Number },
      estimatedSex: { type: String },
      model: { type: String },
      error: { type: String },
    },

    /** Raw AI output, kept unchanged so its accuracy can be measured later. */
    extraction: {
      status: { type: String, enum: ["ok", "refused", "error", "unavailable"] },
      model: { type: String },
      error: { type: String },
      attributes: { type: Schema.Types.Mixed },
    },

    /** Officer-confirmed details (AI suggestions after review). */
    details: { type: Schema.Types.Mixed, default: undefined },
    detailsConfirmedAt: { type: Date },
    /** [lng, lat] of the found location, for distance scoring in reverse matching. */
    foundPoint: { type: [Number], default: undefined },
    /** Suggestions added by reverse matching since an admin last opened the review. */
    newMatchCount: { type: Number, min: 0, default: 0 },

    /** Matching inputs derived from details (location, age, gender, notes). */
    optionalInfo: {
      location: { type: String, trim: true, maxlength: 500, default: "" },
      age: { type: Number, min: 0, max: 120, default: null },
      gender: { type: String, trim: true, maxlength: 40, default: "" },
      notes: { type: String, trim: true, maxlength: 1000, default: "" },
    },
    matches: [{
      personId: { type: Schema.Types.ObjectId, ref: "MissingPerson", required: true },
      matchType: { type: String, enum: ["face", "metadata"], required: true, default: "metadata" },
      /** Overall evidence score 0-100 (sum of evidence points). */
      score: { type: Number, min: 0, max: 100, default: 0 },
      confidence: { type: Number, min: 0, max: 1, default: null },
      similarity: { type: Number, default: null },
      band: { type: String, enum: ["strong", "possible", null], default: null },
      /** Why this record was suggested: one entry per piece of evidence. */
      evidence: [{
        _id: false,
        type: { type: String },
        label: { type: String, maxlength: 200 },
        detail: { type: String, maxlength: 500 },
        points: { type: Number },
      }],
      /** Details score from scans made before evidence scoring existed. */
      metadataScore: { type: Number, min: 0, max: 100, default: 0 },
      reason: { type: String, trim: true, maxlength: 500, default: "" },
      /** "scan": found when the scan was submitted; "new_report": a later report (reverse matching). */
      source: { type: String, enum: ["scan", "new_report"], default: "scan" },
      addedAt: { type: Date },
      /** Reviewer decision on this suggestion. */
      decision: {
        status: { type: String, enum: ["pending", "confirmed", "rejected", "needs_verification"], default: "pending" },
        note: { type: String, trim: true, maxlength: 1000, default: "" },
        byUserId: { type: String, default: "" },
        byEmail: { type: String, default: "" },
        at: { type: Date },
      },
    }],
    candidateCount: { type: Number, min: 0, default: 0 },
    analysisStats: { type: Schema.Types.Mixed, default: {} },
    serviceMessage: { type: String, trim: true, maxlength: 500, default: "" },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

const VictimIdentificationScan =
  mongoose.models.VictimIdentificationScan ||
  mongoose.model("VictimIdentificationScan", VictimIdentificationScanSchema);

module.exports = { VictimIdentificationScan };
