const mongoose = require("mongoose");

const { Schema } = mongoose;

const RiskPredictionSchema = new Schema(
  {
    district: { type: String, required: true, trim: true, maxlength: 80, index: true },
    date: { type: Date, required: true, index: true },
    level: {
      type: String,
      enum: ["safe", "low", "medium", "high"],
      required: true,
      index: true,
    },
    confidence: { type: Number, default: 0.75, min: 0, max: 1 },
    source: { type: String, default: "Novelty seed", trim: true, maxlength: 120 },
  },
  { timestamps: true }
);

// One prediction per district per day (UTC midnight).
RiskPredictionSchema.index({ district: 1, date: 1 }, { unique: true });

const RiskPrediction =
  mongoose.models.RiskPrediction || mongoose.model("RiskPrediction", RiskPredictionSchema);

module.exports = { RiskPrediction };

