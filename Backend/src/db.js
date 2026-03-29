const mongoose = require("mongoose");

const { MONGODB_URI } = process.env;

if (!MONGODB_URI) {
  console.warn("MONGODB_URI is not set. Database connection will fail.");
}

let connectionPromise = null;

async function connectDb() {
  if (
    mongoose.connection.readyState === 1 ||
    mongoose.connection.readyState === 2
  ) {
    return;
  }

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI env variable is required to connect to MongoDB.");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(MONGODB_URI);
  }

  await connectionPromise;
}

module.exports = { connectDb };

