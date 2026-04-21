const mongoose = require("mongoose");

const { Schema } = mongoose;

const ResourceProgramSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    target: { type: String, default: "", trim: true },
    date: { type: String, default: "", trim: true },
    location: { type: String, required: true, trim: true },
    resourceFocus: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    createdBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const ResourceProgram =
  mongoose.models.ResourceProgram ||
  mongoose.model("ResourceProgram", ResourceProgramSchema);

module.exports = { ResourceProgram };

