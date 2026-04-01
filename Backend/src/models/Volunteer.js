const mongoose = require("mongoose");

const { Schema } = mongoose;

const VolunteerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    /** Why they want to volunteer / how they can help */
    message: {
      type: String,
      trim: true,
      default: "",
    },
    fullName: { type: String, trim: true, default: "" },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, trim: true, default: "" },
    nicIdNumber: { type: String, trim: true, default: "" },
    phoneNumber: { type: String, trim: true, default: "" },
    emailAddress: { type: String, trim: true, default: "" },
    districtCity: { type: String, trim: true, default: "" },
    currentLocation: { type: String, trim: true, default: "" },
    canTravelOtherDistricts: { type: Boolean, default: false },
    skills: {
      type: [String],
      default: [],
    },
    medicalConditions: { type: String, trim: true, default: "" },
    emergencyContactPerson: { type: String, trim: true, default: "" },
    emergencyContactNumber: { type: String, trim: true, default: "" },
    agreeSafetyGuidelines: { type: Boolean, default: false },
    agreeEmergencyContact: { type: Boolean, default: false },
    availability: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedAt: { type: Date },
    reviewedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const Volunteer =
  mongoose.models.Volunteer || mongoose.model("Volunteer", VolunteerSchema);

module.exports = { Volunteer };
