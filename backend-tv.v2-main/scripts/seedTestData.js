/**
 * scripts/seedTestData.js
 *
 * Llena la base de datos de PRUEBAS con datos de ejemplo en todas las
 * colecciones del proyecto. Es idempotente: se puede correr varias veces
 * sin duplicar datos (usa upsert sobre las claves únicas/naturales de cada
 * modelo).
 *
 * ⚠️  Pensado SOLO para entornos de desarrollo/pruebas. No lo corras nunca
 * apuntando a una base de producción (revisa tu MONGO_URI antes de ejecutar).
 *
 * Uso:
 *   node scripts/seedTestData.js
 *   npm run seed:data
 *
 * Variable opcional:
 *   SEED_CONFIRM=yes   -> si NODE_ENV=production, exige esta variable para
 *                          evitar sembrar datos de prueba por accidente.
 */

require("dotenv").config();
const { connectMongoose, mongoose } = require("../src/config/config.mongoose");

const User = require("../src/models/users.model");
const TipoEquipo = require("../src/models/tipoEquipo");
const TipoTech = require("../src/models/tipoTech.model");
const Polarization = require("../src/models/polarization.model");
const Satellite = require("../src/models/satellite.model");
const Ird = require("../src/models/ird.model");
const Equipo = require("../src/models/equipo.model");
const Contact = require("../src/models/contact.model");
const Signal = require("../src/models/signal.model");
const Channel = require("../src/models/channel.model");
const Flow = require("../src/models/flow.model");
const AuditLog = require("../src/models/auditLog.model");

async function upsertUser(filter, data, label) {
  let doc = await User.findOne(filter);
  if (!doc) {
    doc = new User({ ...filter, ...data });
  } else {
    doc.set(data); // dispara isModified("password") solo si cambió
  }
  await doc.save(); // el pre("save") del modelo hashea el password correctamente
  console.log(`  ✔ ${label}: ${doc._id}`);
  return doc;
}

async function upsert(Model, filter, data, label) {
  const doc = await Model.findOneAndUpdate(
    filter,
    { $set: data },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log(`  ✔ ${label}: ${doc._id}`);
  return doc;
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_CONFIRM !== "yes") {
    console.error(
      "❌ NODE_ENV=production detectado. Si de verdad quieres sembrar datos de prueba aquí, corre con SEED_CONFIRM=yes (no recomendado)."
    );
    process.exit(1);
  }

  await connectMongoose();
  console.log("🌱 Sembrando datos de prueba...\n");

  /* ------------------------------- Usuarios ------------------------------- */
  console.log("Usuarios:");
  await upsertUser(
    { email: "admin.prueba@signaltv-test.example.com" },
    { username: "Admin Prueba", password: "Admin123!", role: "admin" },
    "admin.prueba@signaltv-test.example.com (admin)"
  );
  await upsertUser(
    { email: "invitado@signaltv-test.example.com" },
    { username: "Invitado", password: "Invitado123!", role: "guest" },
    "invitado@signaltv-test.example.com (guest)"
  );

  /* ------------------------------ Catálogos ------------------------------- */
  console.log("\nTipoEquipo:");
  const tipoEquipoNames = ["Receptor IRD", "Switch", "Router", "Codificador"];
  const tiposEquipo = {};
  for (const nombre of tipoEquipoNames) {
    tiposEquipo[nombre] = await upsert(
      TipoEquipo,
      { tipoNombreLower: nombre.toLowerCase() },
      { tipoNombre: nombre },
      nombre
    );
  }

  console.log("\nTipoTech:");
  for (const nombre of ["IP", "RF", "ASI", "Satelital"]) {
    await upsert(TipoTech, { nombreTipo: nombre }, { nombreTipo: nombre }, nombre);
  }

  console.log("\nPolarization:");
  const polarizations = {};
  for (const tipo of ["Horizontal", "Vertical"]) {
    polarizations[tipo] = await upsert(
      Polarization,
      { typePolarization: tipo },
      { typePolarization: tipo },
      tipo
    );
  }

  console.log("\nSatellite:");
  const satellites = {};
  const satelliteDefs = [
    { satelliteName: "Satmex 5", satelliteType: "Horizontal" },
    { satelliteName: "Intelsat 21", satelliteType: "Vertical" },
  ];
  for (const s of satelliteDefs) {
    satellites[s.satelliteName] = await upsert(
      Satellite,
      { satelliteName: s.satelliteName, satelliteType: polarizations[s.satelliteType]._id },
      { satelliteType: polarizations[s.satelliteType]._id },
      s.satelliteName
    );
  }

  console.log("\nIrd:");
  const irdDefs = [
    { nombreIrd: "IRD-01-Motorola", ipAdminIrd: "10.10.1.11", marcaIrd: "Motorola", modelIrd: "DSR-4410" },
    { nombreIrd: "IRD-02-Cisco", ipAdminIrd: "10.10.1.12", marcaIrd: "Cisco", modelIrd: "D9865" },
    { nombreIrd: "IRD-03-Ericsson", ipAdminIrd: "10.10.1.13", marcaIrd: "Ericsson", modelIrd: "RX8200" },
  ];
  const irds = {};
  for (const i of irdDefs) {
    irds[i.nombreIrd] = await upsert(
      Ird,
      { nombreIrd: i.nombreIrd, ipAdminIrd: i.ipAdminIrd },
      i,
      i.nombreIrd
    );
  }

  console.log("\nEquipo:");
  const equipoDefs = [
    {
      nombre: "IRD Estudio Central 1",
      marca: "Motorola",
      modelo: "DSR-4410",
      tipoNombre: "Receptor IRD",
      ip_gestion: "10.10.2.11",
      satellite: "Satmex 5",
      ird: "IRD-01-Motorola",
    },
    {
      nombre: "Switch Core Datacenter",
      marca: "Cisco",
      modelo: "Catalyst 9300",
      tipoNombre: "Switch",
      ip_gestion: "10.10.2.20",
      satellite: null,
      ird: null,
    },
    {
      nombre: "Router Borde Principal",
      marca: "Juniper",
      modelo: "MX204",
      tipoNombre: "Router",
      ip_gestion: "10.10.2.30",
      satellite: null,
      ird: null,
    },
    {
      nombre: "IRD Estudio Central 2",
      marca: "Cisco",
      modelo: "D9865",
      tipoNombre: "Receptor IRD",
      ip_gestion: "10.10.2.12",
      satellite: "Intelsat 21",
      ird: "IRD-02-Cisco",
    },
  ];
  const equipos = {};
  for (const e of equipoDefs) {
    equipos[e.nombre] = await upsert(
      Equipo,
      { nombre: e.nombre, modelo: e.modelo },
      {
        marca: e.marca,
        tipoNombre: tiposEquipo[e.tipoNombre]._id,
        ip_gestion: e.ip_gestion,
        satelliteRef: e.satellite ? satellites[e.satellite]._id : null,
        irdRef: e.ird ? irds[e.ird]._id : null,
      },
      e.nombre
    );
  }

  console.log("\nContact:");
  const contactDefs = [
    { nombreContact: "Juan Pérez", email: "juan.perez@example.com", telefono: "+56911111111" },
    { nombreContact: "María González", email: "maria.gonzalez@example.com", telefono: "+56922222222" },
    { nombreContact: "Pedro Soto", email: "pedro.soto@example.com", telefono: "+56933333333" },
  ];
  const contacts = {};
  for (const c of contactDefs) {
    contacts[c.nombreContact] = await upsert(
      Contact,
      { nombreContact: c.nombreContact },
      c,
      c.nombreContact
    );
  }

  console.log("\nSignal:");
  const signalDefs = [
    {
      nameChannel: "Canal Noticias 24",
      numberChannelSur: "101",
      numberChannelCn: "201",
      logoChannel: "https://i.ibb.co/GQzZ3wBJ/profile-default.png",
      severidadChannel: "Alta",
      tipoServicio: "SD",
      tipoTecnologia: "Satelital",
      source: "Satmex 5",
      contactos: ["Juan Pérez"],
    },
    {
      nameChannel: "Canal Deportes Plus",
      numberChannelSur: "102",
      numberChannelCn: "202",
      logoChannel: "https://i.ibb.co/GQzZ3wBJ/profile-default.png",
      severidadChannel: "Media",
      tipoServicio: "HD",
      tipoTecnologia: "IP",
      source: "Intelsat 21",
      contactos: ["María González"],
    },
    {
      nameChannel: "Canal Cultural",
      numberChannelSur: "103",
      numberChannelCn: "203",
      logoChannel: "https://i.ibb.co/GQzZ3wBJ/profile-default.png",
      severidadChannel: "Baja",
      tipoServicio: "SD",
      tipoTecnologia: "RF",
      source: "Satmex 5",
      contactos: ["Pedro Soto", "Juan Pérez"],
    },
  ];
  const signals = {};
  for (const s of signalDefs) {
    const { contactos, ...rest } = s;
    signals[s.nameChannel] = await upsert(
      Signal,
      { nameChannel: s.nameChannel, tipoTecnologia: s.tipoTecnologia },
      { ...rest, contact: contactos.map((n) => contacts[n]._id) },
      s.nameChannel
    );
  }

  console.log("\nChannel:");
  const channelDefs = [
    {
      nameChannel: "Canal Noticias 24 - Diagrama",
      signal: "Canal Noticias 24",
      numberChannelSur: "101",
      numberChannelCn: "201",
      logoChannel: "https://i.ibb.co/GQzZ3wBJ/profile-default.png",
      severidadChannel: "Alta",
      tipoTecnologia: "Satelital",
      equipoA: "IRD Estudio Central 1",
      equipoB: "Switch Core Datacenter",
    },
    {
      nameChannel: "Canal Deportes Plus - Diagrama",
      signal: "Canal Deportes Plus",
      numberChannelSur: "102",
      numberChannelCn: "202",
      logoChannel: "https://i.ibb.co/GQzZ3wBJ/profile-default.png",
      severidadChannel: "Media",
      tipoTecnologia: "IP",
      equipoA: "IRD Estudio Central 2",
      equipoB: "Router Borde Principal",
    },
  ];
  for (const c of channelDefs) {
    let doc = await Channel.findOne({ nameChannel: c.nameChannel });
    const nodeA = {
      id: "node-a",
      type: "image",
      equipo: equipos[c.equipoA]._id,
      position: { x: 100, y: 100 },
      data: { label: c.equipoA },
    };
    const nodeB = {
      id: "node-b",
      type: "image",
      equipo: equipos[c.equipoB]._id,
      position: { x: 400, y: 100 },
      data: { label: c.equipoB },
    };
    const edge = {
      id: "edge-a-b",
      source: "node-a",
      target: "node-b",
      type: "smoothstep",
      data: { label: "Enlace", direction: "ida" },
    };

    if (!doc) {
      doc = new Channel({
        signal: signals[c.signal]._id,
        nameChannel: c.nameChannel,
        numberChannelSur: c.numberChannelSur,
        numberChannelCn: c.numberChannelCn,
        logoChannel: c.logoChannel,
        severidadChannel: c.severidadChannel,
        tipoTecnologia: c.tipoTecnologia,
        nodes: [nodeA, nodeB],
        edges: [edge],
      });
    } else {
      doc.set({
        signal: signals[c.signal]._id,
        numberChannelSur: c.numberChannelSur,
        numberChannelCn: c.numberChannelCn,
        logoChannel: c.logoChannel,
        severidadChannel: c.severidadChannel,
        tipoTecnologia: c.tipoTecnologia,
        nodes: [nodeA, nodeB],
        edges: [edge],
      });
    }
    await doc.save();
    console.log(`  ✔ ${c.nameChannel}: ${doc._id}`);
  }

  console.log("\nFlow:");
  const flowDefs = [
    {
      name: "Flujo de prueba - Cabecera Principal",
      description: "Flujo de ejemplo generado por el script de seed",
      nodes: [
        { nodeId: "f1", type: "default", position: { x: 0, y: 0 }, data: { label: "Origen" } },
        { nodeId: "f2", type: "default", position: { x: 250, y: 0 }, data: { label: "Destino" } },
      ],
      edges: [{ edgeId: "e1", source: "f1", target: "f2", type: "default", data: {} }],
    },
  ];
  for (const f of flowDefs) {
    let doc = await Flow.findOne({ name: f.name });
    if (!doc) {
      doc = new Flow(f);
    } else {
      doc.set(f);
    }
    await doc.save();
    console.log(`  ✔ ${f.name}: ${doc._id}`);
  }

  console.log("\nAuditLog (registro de ejemplo):");
  const anyAudit = await AuditLog.findOne({ "meta.seed": true });
  if (!anyAudit) {
    const created = await AuditLog.create({
      userEmail: "admin.prueba@signaltv-test.example.com",
      role: "admin",
      action: "seed",
      resource: "seedTestData",
      endpoint: "scripts/seedTestData.js",
      method: "SCRIPT",
      ip: "127.0.0.1",
      statusCode: 200,
      meta: { seed: true, note: "Registro generado por el script de seed" },
    });
    console.log(`  ✔ AuditLog de ejemplo: ${created._id}`);
  } else {
    console.log("  ↷ Ya existía un AuditLog de seed, no se duplica.");
  }

  console.log("\n✅ Seed completo.");
  console.log(
    "\nUsuarios de prueba:\n  admin.prueba@signaltv-test.example.com / Admin123!\n  invitado@signaltv-test.example.com / Invitado123!"
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error sembrando datos de prueba:", err);
  process.exit(1);
});
