const mongoose = require("mongoose");

const { Schema } = mongoose;

const MissionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },

    /** Category helps map missions to skills/labels. */
    category: { type: String, default: "", trim: true },

    /** Where the mission is relevant (district / region). */
    district: { type: String, default: "", trim: true },

    /** Short details shown to volunteers. */
    description: { type: String, default: "", trim: true },

    /** How many volunteers coordinators want. */
    volunteersNeeded: { type: Number, required: true, min: 0, default: 0 },

    /** Required skills / capabilities text. */
    skills: { type: String, default: "", trim: true },

    urgency: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
      index: true,
    },

    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true,
    },

    closedAt: { type: Date },
    closedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const Mission =
  mongoose.models.Mission || mongoose.model("Mission", MissionSchema);

module.exports = { Mission };

