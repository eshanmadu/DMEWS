const mongoose = require("mongoose");

const { Schema } = mongoose;

const LoginLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    district: { type: String, trim: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: true }
);

const LoginLog =
  mongoose.models.LoginLog || mongoose.model("LoginLog", LoginLogSchema);

module.exports = { LoginLog };

