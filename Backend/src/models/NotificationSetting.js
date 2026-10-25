const mongoose = require("mongoose");

const { Schema } = mongoose;

const NotificationSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    smsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const NotificationSetting =
  mongoose.models.NotificationSetting ||
  mongoose.model("NotificationSetting", NotificationSettingSchema);

module.exports = { NotificationSetting };
