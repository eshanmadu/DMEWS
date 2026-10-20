const mongoose = require("mongoose");

const { Schema } = mongoose;

const ResourceInventoryTransactionSchema = new Schema(
  {
    inventoryId: { type: Schema.Types.ObjectId, ref: "ResourceInventory", required: true, index: true },
    type: {
      type: String,
      enum: ["receipt", "reservation", "reservation_release", "dispatch", "damage", "adjustment"],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, required: true, trim: true },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    reference: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    occurredAt: { type: Date, default: Date.now, index: true },
    performedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const ResourceInventoryTransaction =
  mongoose.models.ResourceInventoryTransaction ||
  mongoose.model("ResourceInventoryTransaction", ResourceInventoryTransactionSchema);

module.exports = { ResourceInventoryTransaction };