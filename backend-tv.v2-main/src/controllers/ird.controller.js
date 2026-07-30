// controllers/ird.controller.js
const mongoose = require("mongoose");
const IRD = require("../models/ird.model");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo");

const normalizeLower = (s) => String(s ?? "").trim().toLowerCase();
const normalizeStr = (s) => String(s ?? "").trim();

/* ===========================
   UTILIDADES DE TRANSACCIÓN
   =========================== */
function isTransactionNotSupported(err) {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("Transaction numbers are only allowed") ||
    msg.includes("replica set") ||
    msg.includes("mongos") ||
    msg.includes("does not support transactions") ||
    msg.includes("Retryable writes are not supported")
  );
}

async function runWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work({ session, useSession: true });
      });
      return result;
    } catch (err) {
      console.error("[IRD][TX] Error en transacción:", err?.message || err);
      if (isTransactionNotSupported(err)) {
        console.warn(
          "[IRD][TX] MongoDB no soporta transacciones. Ejecutando sin sesión..."
        );
        return await work({ session: null, useSession: false });
      }
      throw err;
    }
  } finally {
    session.endSession();
  }
}

/* ===========================
   MENSAJE DE DUPLICADOS
   =========================== */
function buildDuplicateMessage(err) {
  const keyValue = err?.keyValue || {};
  const keyPattern = err?.keyPattern || {};

  const hasNombre =
    "nombreIrd" in keyValue || "nombreIrd" in keyPattern;
  const hasIp =
    "ipAdminIrd" in keyValue || "ipAdminIrd" in keyPattern;

  // Índice compuesto nombreIrd + ipAdminIrd
  if (hasNombre && hasIp) {
    const nombre = keyValue?.nombreIrd ?? "(sin valor)";
    const ip = keyValue?.ipAdminIrd ?? "(sin valor)";
    return {
      message: `Duplicado: ya existe un IRD con el nombre "${nombre}" y la IP de administración "${ip}".`,
      detail: keyValue,
      fields: ["nombreIrd", "ipAdminIrd"],
    };
  }

  // Caso genérico
  const field =
    Object.keys(keyValue)[0] || Object.keys(keyPattern)[0] || "campo";
  const value = keyValue?.[field];

  return {
    message:
      value !== undefined
        ? `Duplicado: el valor "${value}" ya existe para el campo "${field}".`
        : `Duplicado: el valor ya existe para el campo "${field}".`,
    detail: keyValue,
    fields: [field],
  };
}

/* ===========================
   HELPERS DE MODELOS
   =========================== */
async function getOrCreateTipoEquipoIdByName(name, { session } = {}) {
  const tipoLower = normalizeLower(name);
  if (!tipoLower) return null;

  const q = TipoEquipo.findOne({ tipoNombreLower: tipoLower })
    .select("_id")
    .lean();
  if (session) q.session(session);

  const found = await q;
  if (found?._id) return found._id;

  const payload = {
    tipoNombre: String(name).trim(),
    tipoNombreLower: tipoLower,
  };

  const createdArr = await TipoEquipo.create(
    [payload],
    session ? { session } : undefined
  );
  const created = createdArr?.[0];

  return created?._id ?? null;
}

async function populateEquipoById(equipoId) {
  if (!equipoId) return null;
  return Equipo.findById(equipoId)
    .populate("tipoNombre")
    .populate("irdRef")
    .lean();
}

/* ===========================
   GETS
   =========================== */
module.exports.getIrd = async (_req, res) => {
  try {
    const irds = await IRD.find().sort({ ipAdminIrd: 1 }).lean();
    res.json(irds);
  } catch (error) {
    console.error("[IRD][GET] Error al listar IRD:", error);
    res.status(500).json({ message: "Error al obtener la lista de IRD." });
  }
};

module.exports.getIdIrd = async (req, res) => {
  try {
    const id = req.params.id;
    const ird = await IRD.findById(id).lean();
    if (!ird)
      return res.status(404).json({ message: "IRD no encontrado." });

    res.json(ird);
  } catch (error) {
    console.error("[IRD][GET] Error al obtener IRD:", error);
    res.status(500).json({ message: "Error al obtener el IRD." });
  }
};

/* ===========================
   CREATE
   =========================== */
module.exports.createIrd = async (req, res) => {
  let createdIrdId = null;

  try {
    const out = await runWithOptionalTransaction(async ({ session }) => {
      // 1) Crear IRD (normalizado)
      const payloadIrd = {
        ...req.body,
        nombreIrd: normalizeStr(req.body?.nombreIrd),
        ipAdminIrd: normalizeStr(req.body?.ipAdminIrd),
      };

      const created = await IRD.create(
        [payloadIrd],
        session ? { session } : undefined
      );
      const createdIrd = created?.[0];

      if (!createdIrd?._id)
        throw { status: 500, message: "No se pudo crear el IRD." };

      createdIrdId = createdIrd._id;

      // 2) TipoEquipo "ird"
      const tipoIrdId = await getOrCreateTipoEquipoIdByName("ird", { session });
      if (!tipoIrdId)
        throw {
          status: 500,
          message: "No se pudo resolver o crear el tipo de equipo 'ird'.",
        };

      // 3) Crear Equipo asociado
      const payloadEquipo = {
        nombre: normalizeStr(createdIrd.nombreIrd),
        marca: normalizeStr(createdIrd.marcaIrd),
        modelo: normalizeStr(createdIrd.modelIrd),
        tipoNombre: tipoIrdId,
        ip_gestion: normalizeStr(createdIrd.ipAdminIrd) || null,
        irdRef: createdIrd._id,
      };

      const eqCreated = await Equipo.create(
        [payloadEquipo],
        session ? { session } : undefined
      );
      const equipo = eqCreated?.[0];

      if (!equipo?._id)
        throw {
          status: 500,
          message: "No se pudo crear el equipo asociado al IRD.",
        };

      const equipoPopulado = await populateEquipoById(equipo._id);

      return { createdIrd, equipoPopulado };
    });

    return res.status(201).json({
      ird: out.createdIrd,
      equipo: out.equipoPopulado,
      equipoInfo: {
        created: true,
        reason:
          "El equipo IRD fue creado automáticamente y asociado correctamente.",
        tipoEquipo: "ird",
      },
    });
  } catch (error) {
    console.error("[IRD][CREATE] Error:", error);

    // Limpieza si se creó el IRD sin transacción real
    try {
      if (createdIrdId) {
        console.warn(
          "[IRD][CREATE] Limpieza: eliminando IRD creado por error:",
          createdIrdId
        );
        await IRD.deleteOne({ _id: createdIrdId });
      }
    } catch (cleanupErr) {
      console.warn("[IRD][CREATE] Error en limpieza:", cleanupErr);
    }

    if (error?.code === 11000) {
      const dup = buildDuplicateMessage(error);
      return res.status(409).json(dup);
    }

    if (error?.status)
      return res.status(error.status).json({ message: error.message });

    return res.status(500).json({
      message: "Error al crear el IRD.",
      detail: error?.message || error,
    });
  }
};

/* ===========================
   UPDATE
   =========================== */
module.exports.updateIrd = async (req, res) => {
  try {
    const id = req.params.id;

    const out = await runWithOptionalTransaction(async ({ session }) => {
      // 1) Actualizar IRD (normalizado)
      const payloadUpdate = {
        ...req.body,
        ...(req.body?.nombreIrd !== undefined
          ? { nombreIrd: normalizeStr(req.body?.nombreIrd) }
          : {}),
        ...(req.body?.ipAdminIrd !== undefined
          ? { ipAdminIrd: normalizeStr(req.body?.ipAdminIrd) }
          : {}),
      };

      const qIrd = IRD.findByIdAndUpdate(id, payloadUpdate, { new: true });
      if (session) qIrd.session(session);
      const updatedIrd = await qIrd.lean();

      if (!updatedIrd?._id)
        throw { status: 404, message: "IRD no encontrado." };

      // 2) TipoEquipo "ird"
      const tipoIrdId = await getOrCreateTipoEquipoIdByName("ird", { session });
      if (!tipoIrdId)
        throw {
          status: 500,
          message: "No se pudo resolver o crear el tipo de equipo 'ird'.",
        };

      // 3) Actualizar equipo asociado
      const payloadEquipo = {
        nombre: normalizeStr(updatedIrd.nombreIrd) || "IRD",
        marca: normalizeStr(updatedIrd.marcaIrd) || "IRD",
        modelo: normalizeStr(updatedIrd.modelIrd) || "IRD",
        tipoNombre: tipoIrdId,
        ip_gestion: normalizeStr(updatedIrd.ipAdminIrd) || null,
      };

      const qEq = Equipo.findOneAndUpdate(
        { irdRef: updatedIrd._id },
        { $set: payloadEquipo },
        { new: true }
      );
      if (session) qEq.session(session);
      let updatedEquipo = await qEq;

      if (!updatedEquipo?._id) {
        const createdArr = await Equipo.create(
          [{ ...payloadEquipo, irdRef: updatedIrd._id }],
          session ? { session } : undefined
        );
        updatedEquipo = createdArr?.[0] ?? null;
      }

      const equipoPopulado = await populateEquipoById(updatedEquipo?._id);

      return { updatedIrd, equipoPopulado };
    });

    return res.json({
      ird: out.updatedIrd,
      equipo: out.equipoPopulado || null,
    });
  } catch (error) {
    console.error("[IRD][UPDATE] Error:", error);

    if (error?.code === 11000) {
      const dup = buildDuplicateMessage(error);
      return res.status(409).json(dup);
    }

    if (error?.status)
      return res.status(error.status).json({ message: error.message });

    return res.status(500).json({
      message: "Error al actualizar el IRD.",
      detail: error?.message || error,
    });
  }
};

/* ===========================
   DELETE
   =========================== */
module.exports.deleteIrd = async (req, res) => {
  try {
    const id = req.params.id;

    await runWithOptionalTransaction(async ({ session }) => {
      const qDel = IRD.findByIdAndDelete(id);
      if (session) qDel.session(session);
      const deleted = await qDel;

      if (!deleted?._id)
        throw { status: 404, message: "IRD no encontrado." };

      const qEqDel = Equipo.deleteMany({ irdRef: deleted._id });
      if (session) qEqDel.session(session);
      await qEqDel;
    });

    return res.json({ message: "IRD eliminado correctamente." });
  } catch (error) {
    console.error("[IRD][DELETE] Error:", error);

    if (error?.status)
      return res.status(error.status).json({ message: error.message });

    return res.status(500).json({
      message: "Error al eliminar el IRD.",
      detail: error?.message || error,
    });
  }
};