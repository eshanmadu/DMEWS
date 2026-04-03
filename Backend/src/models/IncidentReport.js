const mongoose = require("mongoose");

const { Schema } = mongoose;

const MediaSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    resourceType: { type: String, default: "" }, // image | video | raw
    format: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
  },
  { _id: false }
);

const IncidentReportSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userSnapshot: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      district: { type: String, default: "" },
      mobile: { type: String, default: "" },
      avatar: { type: String, default: "" },
    },
    district: { type: String, required: true, trim: true, index: true },
    // Optional free-text location detail provided by the reporter
    // e.g. "Kandy District, A9 km 42" or "Near bus stand, Negombo"
    area: { type: String, default: "", trim: true, maxlength: 200 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
  // Optional user-provided incident date (validated by frontend/backend).
  // If not provided, we fall back to `createdAt` via timestamps.
  reportedAt: { type: Date, default: null, index: true },
    media: { type: [MediaSchema], default: [] }, // optional
    status: {
      type: String,
      enum: ["reported", "assessing", "responding", "resolved"],
      default: "reported",
      index: true,
    },
  },
  { timestamps: true }
);

const IncidentReport =
  mongoose.models.IncidentReport ||
  mongoose.model("IncidentReport", IncidentReportSchema);

module.exports = { IncidentReport };

