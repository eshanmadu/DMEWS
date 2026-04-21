const mongoose = require("mongoose");

const { Schema } = mongoose;

const ResourceParticipationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    resourceType: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    availableDate: { type: Date, required: true },
    canTransport: { type: Boolean, default: false },
    deliveryMode: {
      type: String,
      enum: ["self-drop", "pickup"],
      required: true,
      default: "self-drop",
    },
    pickupAddress: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "contacted", "scheduled", "collected", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

const ResourceParticipation =
  mongoose.models.ResourceParticipation ||
  mongoose.model("ResourceParticipation", ResourceParticipationSchema);

module.exports = { ResourceParticipation };

