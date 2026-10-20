const mongoose = require("mongoose");

const { Schema } = mongoose;

const ResourceInventorySchema = new Schema(
  {
    resourceType: { type: String, required: true, trim: true, index: true },
    unit: { type: String, required: true, trim: true },
    storageLocation: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true, index: true },
    expiryDate: { type: Date, default: null, index: true },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    availableQuantity: { type: Number, default: 0, min: 0 },
    dispatchedQuantity: { type: Number, default: 0, min: 0 },
    damagedQuantity: { type: Number, default: 0, min: 0 },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const ResourceInventory =
  mongoose.models.ResourceInventory ||
  mongoose.model("ResourceInventory", ResourceInventorySchema);

module.exports = { ResourceInventory };