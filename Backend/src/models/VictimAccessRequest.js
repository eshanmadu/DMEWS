const mongoose = require("mongoose");

const { Schema } = mongoose;

const VICTIM_ACCESS_ROLES = [
  "Police Investigator",
  "Medical Examiner",
  "Forensic Officer",
  "Disaster Management Officer",
  "Search and Rescue Officer",
];

const VictimAccessRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    requestedRole: { type: String, required: true, trim: true },
    approvedRole: { type: String, enum: [...VICTIM_ACCESS_ROLES, ""], trim: true, default: "" },
    organization: { type: String, required: true, trim: true },
    employeeId: { type: String, required: true, trim: true },
    documentUrl: { type: String, required: true, trim: true },
    documentPublicId: { type: String, trim: true, default: "" },
    documentFormat: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewedAt: { type: Date },
    reviewedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const VictimAccessRequest = mongoose.models.VictimAccessRequest || mongoose.model("VictimAccessRequest", VictimAccessRequestSchema);

module.exports = { VictimAccessRequest, VICTIM_ACCESS_ROLES };