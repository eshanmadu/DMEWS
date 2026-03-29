const mongoose = require("mongoose");

const { Schema } = mongoose;

const RiskLevelSchema = new Schema(
  {
    district: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    level: {
      type: String,
      enum: ["safe", "low", "medium", "high"],
      default: "safe",
    },
  },
  {
    timestamps: true,
  }
);

const RiskLevel =
  mongoose.models.RiskLevel || mongoose.model("RiskLevel", RiskLevelSchema);

module.exports = { RiskLevel };

