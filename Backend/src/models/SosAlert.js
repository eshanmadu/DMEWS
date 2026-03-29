const mongoose = require("mongoose");

const { Schema } = mongoose;

const SosAlertSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** Profile fields copied at send time for admin review even if user later edits account. */
    userSnapshot: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      district: { type: String, default: "" },
      mobile: { type: String, default: "" },
      avatar: { type: String, default: "" },
      volunteerStatus: { type: String, default: "none" },
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    clientHint: {
      userAgent: { type: String, default: "" },
      sentFrom: { type: String, default: "home" },
    },
    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved"],
      default: "open",
      index: true,
    },
  },
  { timestamps: true }
);

const SosAlert =
  mongoose.models.SosAlert || mongoose.model("SosAlert", SosAlertSchema);

module.exports = { SosAlert };
