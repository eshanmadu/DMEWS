const mongoose = require("mongoose");

const foundPersonSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Unknown", trim: true, maxlength: 200 },
    age: { type: Number, default: null, min: 0, max: 120 },
    locationFound: { type: String, required: true, trim: true, maxlength: 500 },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
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
    reporterName: { type: String, default: "", trim: true, maxlength: 200 },
    ifYouSeePhone: { type: String, default: "", trim: true, maxlength: 50 },
  },
  { timestamps: true }
);

foundPersonSchema.index({ createdAt: -1 });
foundPersonSchema.index({ location: "2dsphere" });

const FoundPerson =
  mongoose.models.FoundPerson ||
  mongoose.model("FoundPerson", foundPersonSchema);

module.exports = { FoundPerson };
