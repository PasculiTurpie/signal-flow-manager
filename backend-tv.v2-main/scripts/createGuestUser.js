/**
 * scripts/createGuestUser.js
 *
 * Crea (o actualiza la contraseña de) un usuario "invitado" para el panel
 * de administración. Es idempotente: si el email ya existe, solo actualiza
 * password/username/role; si no existe, lo crea.
 *
 * Uso:
 *   node scripts/createGuestUser.js
 *
 * Variables de entorno opcionales (si no las defines, se usan valores por
 * defecto pensados solo para desarrollo):
 *   GUEST_EMAIL     (default: invitado@signaltv.local)
 *   GUEST_USERNAME  (default: Invitado)
 *   GUEST_PASSWORD  (default: se genera una aleatoria y se imprime en consola)
 *   GUEST_ROLE      (default: guest)
 *
 * IMPORTANTE:
 * El backend actual NO restringe permisos por rol (authRequired solo exige
 * estar logueado; no hay chequeo role === "admin" en las rutas mutantes).
 * Esto significa que, tal como está el código hoy, un usuario con role
 * "guest" puede crear/editar/borrar igual que un admin. Este script deja el
 * campo "role" en "guest" para que quede identificado, pero si quieres que
 * el invitado sea realmente de solo lectura, hace falta agregar un
 * middleware de autorización por rol (puedo ayudarte con eso si quieres).
 */

require('dotenv').config()
const crypto = require('crypto')
const { connectMongoose, mongoose } = require('../src/config/config.mongoose')
const User = require('../src/models/users.model')

const GUEST_EMAIL = (
  process.env.GUEST_EMAIL || 'invitado@signaltv.local'
).toLowerCase()
const GUEST_USERNAME = process.env.GUEST_USERNAME || 'Invitado'
const GUEST_ROLE = process.env.GUEST_ROLE || 'guest'
const GUEST_PASSWORD =
  process.env.GUEST_PASSWORD || crypto.randomBytes(9).toString('base64url')

async function main () {
  await connectMongoose()

  const existing = await User.findOne({ email: GUEST_EMAIL })

  if (existing) {
    existing.username = GUEST_USERNAME
    existing.role = GUEST_ROLE
    existing.password = GUEST_PASSWORD // el pre('save') del modelo la vuelve a hashear
    await existing.save()
    console.log('✅ Usuario invitado actualizado:')
  } else {
    const guest = new User({
      username: GUEST_USERNAME,
      email: GUEST_EMAIL,
      password: GUEST_PASSWORD,
      role: GUEST_ROLE
    })
    await guest.save()
    console.log('✅ Usuario invitado creado:')
  }

  console.log({
    email: GUEST_EMAIL,
    username: GUEST_USERNAME,
    role: GUEST_ROLE,
    password: GUEST_PASSWORD
  })
  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Error creando el usuario invitado:', err)
  process.exit(1)
})
