const mongoose = require("mongoose");

const { Schema } = mongoose;

const ShelterSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    district: {
      type: String,
      required: true,
      trim: true,
    },
    /** City / area within district (English label), from location API */
    city: {
      type: String,
      trim: true,
      default: "",
    },
    cityLatitude: { type: Number },
    cityLongitude: { type: Number },
    capacity: {
      type: Number,
      required: true,
      min: 0,
    },
    occupied: {
      type: Number,
      default: 0,
      min: 0,
    },
    availability: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    condition: {
      type: String,
      enum: ["good", "fair", "needs-attention", "critical"],
      default: "good",
    },
    contact: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const Shelter =
  mongoose.models.Shelter || mongoose.model("Shelter", ShelterSchema);

module.exports = { Shelter };
