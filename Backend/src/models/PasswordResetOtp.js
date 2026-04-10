const mongoose = require("mongoose");

const { Schema } = mongoose;

const PasswordResetOtpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

PasswordResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetOtp =
  mongoose.models.PasswordResetOtp ||
  mongoose.model("PasswordResetOtp", PasswordResetOtpSchema);

module.exports = { PasswordResetOtp };
