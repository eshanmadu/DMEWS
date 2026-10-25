const { connectDb } = require("../db");
const { User } = require("../models/User");
const { NotificationSetting } = require("../models/NotificationSetting");

const NOTIFY_USER_ID = process.env.NOTIFY_USER_ID;
const NOTIFY_API_KEY = process.env.NOTIFY_API_KEY;
const NOTIFY_SENDER_ID = process.env.NOTIFY_SENDER_ID;

async function sendHighRiskSmsForDistrict(district) {
  try {
    if (!NOTIFY_USER_ID || !NOTIFY_API_KEY || !NOTIFY_SENDER_ID) {
      console.error("Notify.lk SMS is not configured.");
      return;
    }

    await connectDb();
    const setting = await NotificationSetting.findOne({ key: "risk-sms" }).lean().exec();
    if (setting?.smsEnabled === false) return;

    const users = await User.find({
      district,
      mobile: { $exists: true, $ne: "" },
    })
      .select("mobile")
      .lean()
      .exec();

    await Promise.all(
      users.map(async (user) => {
        let to = String(user.mobile || "").trim();
        if (to.startsWith("0") && to.length >= 9) to = `94${to.slice(1)}`;
        if (!to.startsWith("94")) return;

        const params = new URLSearchParams({
          user_id: NOTIFY_USER_ID,
          api_key: NOTIFY_API_KEY,
          sender_id: NOTIFY_SENDER_ID,
          to,
          message: `High risk alert for ${district} district. Please stay alert and follow official safety instructions.`,
        });
        const response = await fetch(`https://app.notify.lk/api/v1/send?${params}`);
        if (!response.ok) {
          console.error("Notify.lk SMS request failed", response.status, district);
        }
      })
    );
  } catch (error) {
    console.error("High risk SMS job failed", error);
  }
}

module.exports = { sendHighRiskSmsForDistrict };
