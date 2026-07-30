const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    profilePicture: {
      type: String,
      default: "https://i.ibb.co/GQzZ3wBJ/profile-default.png",
      trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: "admin",
      trim: true,
    },
  },
  { timestamps: true, versionKey: false }
);

// 🔒 Middleware para encriptar antes de guardar
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // no volver a encriptar
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// 🔒 Middleware para encriptar antes de actualizar
UserSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  if (update.password && !update.password.startsWith("$2b$")) {
    const salt = await bcrypt.genSalt(10);
    update.password = await bcrypt.hash(update.password, salt);
  }

  next();
});


const User = mongoose.model("User", UserSchema);
module.exports = User;
