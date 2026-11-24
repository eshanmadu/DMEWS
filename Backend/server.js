const dotenv = require("dotenv");
const chalk = require("chalk");
dotenv.config();

const { connectDb } = require("./src/db");
const app = require("./src/app");
const { purgeExpiredScanPhotos } = require("./src/controllers/victimIdentificationController");

/** Delete victim scan photos past their retention period (on start, then every 6 hours). */
function scheduleScanPhotoRetention() {
  const run = () =>
    purgeExpiredScanPhotos()
      .then((count) => count && console.log(`Victim scan photos: removed photos of ${count} expired scan(s).`))
      .catch((error) => console.error("Victim scan photo retention failed", error?.message || error));
  run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}

const PORT = process.env.PORT || 4000;

connectDb()
  .then(() => {
    scheduleScanPhotoRetention();
    app.listen(PORT, () => {
      console.log(
  chalk.green.bold("🚀 DMEWS Backend is LIVE!") +
  "\n" +
  chalk.cyan(`🌐 http://localhost:${PORT}`)
);
    });
  })
  .catch((error) => {
    console.error(chalk.red("Failed to connect to MongoDB"), error);
    process.exit(1);
  });

