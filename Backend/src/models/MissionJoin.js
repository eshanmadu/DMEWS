const mongoose = require("mongoose");
const { Schema } = mongoose;

const MissionJoinSchema = new Schema(
  {
    missionId: {
      type: Schema.Types.ObjectId,
      ref: "Mission",
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

MissionJoinSchema.index({ missionId: 1, userId: 1 }, { unique: true });

const MissionJoin =
  mongoose.models.MissionJoin ||
  mongoose.model("MissionJoin", MissionJoinSchema);

module.exports = { MissionJoin };

