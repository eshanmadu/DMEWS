const mongoose = require("mongoose");

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    mobile: {
      type: String,
      trim: true,
      default: "",
    },
    passwordHash: {
      type: String,
      required: false,
    },
    /** Google subject ("sub") when user signs in with Google */
    googleSub: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    /** User-selected language (e.g. "en", "si") */
    preferredLanguage: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const User =
  mongoose.models.User || mongoose.model("User", UserSchema);

module.exports = { User };

