const mongoose = require("mongoose");

const foundPersonSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Unknown", trim: true, maxlength: 200 },
    age: { type: Number, default: null, min: 0, max: 120 },
    locationFound: { type: String, required: true, trim: true, maxlength: 500 },
    dateFound: { type: Date, required: true },
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

foundPersonSchema.index({ createdAt: -1 });

const FoundPerson =
  mongoose.models.FoundPerson ||
  mongoose.model("FoundPerson", foundPersonSchema);

module.exports = { FoundPerson };
