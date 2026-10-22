const mongoose = require("mongoose");

const { Schema } = mongoose;

const ShelterCapacityVoteSchema = new Schema(
  {
    shelter: { type: Schema.Types.ObjectId, ref: "Shelter", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    occupied: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

ShelterCapacityVoteSchema.index({ shelter: 1, user: 1 }, { unique: true });

const ShelterCapacityVote =
  mongoose.models.ShelterCapacityVote ||
  mongoose.model("ShelterCapacityVote", ShelterCapacityVoteSchema);

module.exports = { ShelterCapacityVote };
