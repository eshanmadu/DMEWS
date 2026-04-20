const { connectDb } = require("../db");
const { User } = require("../models/User");

const NOTIFY_USER_ID = process.env.NOTIFY_USER_ID || "31544";
const NOTIFY_API_KEY = process.env.NOTIFY_API_KEY || "iFCYeeS3QTEW1qxONSMI";
const NOTIFY_SENDER_ID = process.env.NOTIFY_SENDER_ID || "NotifyDEMO";

async function sendHighRiskSmsForDistrict(district) {
  try {
    await connectDb();

    const users = await User.find({
      district: district,
      mobile: { $exists: true, $ne: "" },
    })
      .select("mobile name email district")
      .lean()
      .exec();

    if (!users.length) return;

    const baseUrl = "https://app.notify.lk/api/v1/send";

    await Promise.all(
      users.map(async (u) => {
        let to = String(u.mobile).trim();
        if (!to) return;

        if (to.startsWith("0") && to.length >= 9) {
          to = "94" + to.slice(1);
        }
        if (!to.startsWith("94")) {
          return;
        }

        const params = new URLSearchParams({
          user_id: NOTIFY_USER_ID,
          api_key: NOTIFY_API_KEY,
          sender_id: NOTIFY_SENDER_ID,
          to,
          message: `High risk alert for ${district} district. Please stay alert and follow official safety instructions.`,
        });

        const url = `${baseUrl}?${params.toString()}`;
        try {
          await fetch(url);
        } catch (err) {
          console.warn(
            "Failed to send SMS via Notify.lk",
            err?.message || err
          );
        }
      })
    );
  } catch (err) {
    console.warn("High risk SMS job failed", err?.message || err);
  }
}

module.exports = { sendHighRiskSmsForDistrict };

