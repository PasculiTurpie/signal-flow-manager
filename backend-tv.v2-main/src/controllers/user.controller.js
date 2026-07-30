const User = require("../models/users.model");

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const plain = userDoc.toObject ? userDoc.toObject() : userDoc;
  const rawId = plain._id;
  const id =
    typeof rawId === "string"
      ? rawId
      : rawId && typeof rawId.toString === "function"
      ? rawId.toString()
      : rawId || null;

  return {
    id,
    username: plain.username,
    email: plain.email,
    role: plain.role,
    profilePicture: plain.profilePicture,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

const pickMutableFields = (payload) => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const output = {};
  const { username, email, password, profilePicture, role } = payload;

  if (username !== undefined) output.username = username;
  if (email !== undefined) output.email = email;
  if (password !== undefined) output.password = password;
  if (profilePicture !== undefined) output.profilePicture = profilePicture;
  if (role !== undefined) output.role = role;

  return output;
};

module.exports.getAllUser = async (_req, res) => {
  try {
    const users = await User.find()
      .select("username email role profilePicture createdAt updatedAt")
      .sort({ username: 1 })
      .lean();

    return res.json(users.map(sanitizeUser));
  } catch (error) {
    console.error("Error capturado en catch:", error.message);
    return res.status(500).json({ message: "Error al obtener usuarios" });
  }
};

module.exports.getUserId = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean();
    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });
    res.json(sanitizeUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener usuario" });
  }
};

module.exports.createUser = async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Falta el nombre, correo o contraseña" });
    }

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Usuario ya existe con ese correo" });
    }

    const newUser = new User(
      pickMutableFields({ username, email, password, role: req.body.role })
    );

    const savedUser = await newUser.save();

    res.status(201).json({
      message: "Usuario creado con éxito!",
      user: sanitizeUser(savedUser),
    });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "Usuario ya existe con ese correo" });
    }
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ message: "Usuario eliminado de la Base de datos" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar usuario" });
  }
};

module.exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const updateData = pickMutableFields(req.body);

  try {
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json({
      message: "Usuario actualizado exitosamente",
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "Usuario ya existe con ese correo" });
    }
    res.status(500).json({ message: "Error al actualizar usuario" });
  }
};

module.exports.getUserById = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.params?.id;
    if (!userId) {
      return res.status(400).json({ message: "Usuario no autenticado" });
    }

    const user = await User.findById(userId).select("-password").lean();
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener el usuario" });
  }
};
