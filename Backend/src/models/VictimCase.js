const mongoose = require("mongoose");

const { Schema } = mongoose;

const VictimCaseSchema = new Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    location: { type: String, required: true, trim: true },
    caseDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Under Investigation", "Identified", "Closed"],
      default: "Under Investigation",
      index: true,
    },
    evidenceUrl: { type: String, required: true, trim: true },
    evidencePublicId: { type: String, trim: true, default: "" },
    evidenceFormat: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const VictimCase = mongoose.models.VictimCase || mongoose.model("VictimCase", VictimCaseSchema);

module.exports = { VictimCase };