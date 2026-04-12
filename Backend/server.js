const dotenv = require("dotenv");
const chalk = require("chalk");
dotenv.config();

const { connectDb } = require("./src/db");
const app = require("./src/app");

const PORT = process.env.PORT || 4000;

connectDb()
  .then(() => {
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

