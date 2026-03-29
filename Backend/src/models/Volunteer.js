const mongoose = require("mongoose");

const { Schema } = mongoose;

const VolunteerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    /** Why they want to volunteer / how they can help */
    message: {
      type: String,
      trim: true,
      default: "",
    },
    skills: {
      type: String,
      trim: true,
      default: "",
    },
    availability: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedAt: { type: Date },
    reviewedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const Volunteer =
  mongoose.models.Volunteer || mongoose.model("Volunteer", VolunteerSchema);

module.exports = { Volunteer };
