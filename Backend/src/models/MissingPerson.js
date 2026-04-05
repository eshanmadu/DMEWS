const mongoose = require("mongoose");

const missingPersonSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, default: "", trim: true, maxlength: 40 },
    lastSeenLocation: { type: String, required: true, trim: true, maxlength: 500 },
    dateMissing: { type: Date, required: true },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    contactInfo: { type: String, default: "", trim: true, maxlength: 500 },
    photoUrl: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
    submittedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

missingPersonSchema.index({ createdAt: -1 });

const MissingPerson =
  mongoose.models.MissingPerson ||
  mongoose.model("MissingPerson", missingPersonSchema);

module.exports = { MissingPerson };
