const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    disasterType: {
      type: String,
      required: true,
      enum: ["Flood", "Landslide", "Cyclone", "Tsunami"],
      trim: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ["Low", "Medium", "High"],
      trim: true,
    },
    affectedArea: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    expectedEndTime: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    safetyInstructions: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Expired", "Cancelled", "Archived"],
      default: "Active",
    },
    createdBy: {
      type: String,
      default: "Admin",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Alert", alertSchema);