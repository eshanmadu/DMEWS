const mongoose = require("mongoose");

const missingPersonSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, default: "", trim: true, maxlength: 40 },
    lastSeenLocation: { type: String, required: true, trim: true, maxlength: 500 },
    /**
     * GeoJSON point, set only when the place could be located. No default:
     * a {type: "Point"} without coordinates is rejected by the 2dsphere index,
     * which made reports with unrecognised place names fail to save.
     */
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
        validate: {
          validator: (v) => !v || (Array.isArray(v) && v.length === 2),
          message: "location.coordinates must be [lng, lat]",
        },
      },
    },
    dateMissing: { type: Date, required: true },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    contactInfo: { type: String, default: "", trim: true, maxlength: 500 },
    /**
     * Structured tattoos, scars, birthmarks, piercings, other marks, clothing,
     * jewellery, personal items and readable text (services/personDetails.js
     * cleanFeatures shape). Entered by the reporter, optionally pre-filled by
     * the local vision model from the photo.
     */
    identifyingFeatures: { type: mongoose.Schema.Types.Mixed, default: undefined },
    photoUrl: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
    /**
     * Face encoding of photoUrl, computed once by the face service at upload
     * time (or by scripts/backfillMatchingIndex.js). The embedding is biometric
     * data: it is excluded from queries unless selected with "+face.embedding".
     */
    face: {
      status: {
        type: String,
        enum: ["ok", "no_face", "multiple_faces", "error"],
      },
      embedding: { type: [Number], default: undefined, select: false },
      model: { type: String },
      photoUrl: { type: String },
      faceCount: { type: Number },
      quality: { type: mongoose.Schema.Types.Mixed },
      estimatedAge: { type: Number },
      estimatedSex: { type: String },
      error: { type: String },
      computedAt: { type: Date },
    },
    /**
     * Sentence embeddings of the description, for comparing body marks and
     * clothing by meaning (services/matching.js). Items hidden unless selected
     * with "+textIndex.items".
     */
    textIndex: {
      status: { type: String, enum: ["ok", "error"] },
      model: { type: String },
      sourceHash: { type: String },
      items: {
        type: [{ _id: false, text: String, embedding: [Number] }],
        default: undefined,
        select: false,
      },
      error: { type: String },
      computedAt: { type: Date },
    },
    submittedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    /** Snapshot from User at submit time (logged-in reporters) */
    reporterName: { type: String, default: "", trim: true, maxlength: 200 },
    ifYouSeePhone: { type: String, default: "", trim: true, maxlength: 50 },
  },
  { timestamps: true }
);

missingPersonSchema.index({ createdAt: -1 });
missingPersonSchema.index({ location: "2dsphere" });

const MissingPerson =
  mongoose.models.MissingPerson ||
  mongoose.model("MissingPerson", missingPersonSchema);

module.exports = { MissingPerson };
