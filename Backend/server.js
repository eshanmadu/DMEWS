const dotenv = require("dotenv");
dotenv.config();

const { connectDb } = require("./src/db");
const app = require("./src/app");

const PORT = process.env.PORT || 4000;

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 DMEWS Backend JS running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });

