const { connectDb } = require("../db");
const { Volunteer } = require("../models/Volunteer");

/**
 * @param {string} userId
 * @returns {Promise<"pending"|"approved"|"rejected"|null>}
 */
async function getVolunteerStatusForUser(userId) {
  if (!userId) return null;
  await connectDb();
  const v = await Volunteer.findOne({ userId }).select("status").lean().exec();
  return v?.status || null;
}

module.exports = { getVolunteerStatusForUser };
