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
  },
  {
    timestamps: true,
  }
);

const Shelter =
  mongoose.models.Shelter || mongoose.model("Shelter", ShelterSchema);

module.exports = { Shelter };
