const mongoose = require("mongoose");

const { Schema } = mongoose;

const VictimIdentificationScanSchema = new Schema(
  {
    officerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["processing", "completed", "unavailable", "failed"], required: true },
    optionalInfo: {
      location: { type: String, trim: true, maxlength: 500, default: "" },
      age: { type: Number, min: 0, max: 120, default: null },
      gender: { type: String, trim: true, maxlength: 40, default: "" },
      notes: { type: String, trim: true, maxlength: 1000, default: "" },
    },
    matches: [{
      personId: { type: Schema.Types.ObjectId, ref: "MissingPerson", required: true },
      confidence: { type: Number, min: 0, max: 1, required: true },
      metadataScore: { type: Number, min: 0, max: 100, default: 0 },
      reason: { type: String, trim: true, maxlength: 500, default: "" },
    }],
    candidateCount: { type: Number, min: 0, default: 0 },
    serviceMessage: { type: String, trim: true, maxlength: 500, default: "" },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

const VictimIdentificationScan =
  mongoose.models.VictimIdentificationScan ||
  mongoose.model("VictimIdentificationScan", VictimIdentificationScanSchema);

module.exports = { VictimIdentificationScan };
