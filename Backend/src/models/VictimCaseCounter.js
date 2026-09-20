const mongoose = require("mongoose");

const VictimCaseCounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  sequence: { type: Number, default: 0 },
});

const VictimCaseCounter = mongoose.models.VictimCaseCounter || mongoose.model("VictimCaseCounter", VictimCaseCounterSchema);

module.exports = { VictimCaseCounter };