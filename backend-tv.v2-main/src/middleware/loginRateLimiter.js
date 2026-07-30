// middlewares/loginRateLimiter.js
// Limitador simple en memoria contra fuerza bruta en /auth/login.
// Cuenta intentos por IP dentro de una ventana de tiempo se resetea al loguearse con éxito.

const WINDOW_MS = 15 * 60 * 1000 // 15 minutos
const MAX_ATTEMPTS = 10

const attemptsByKey = new Map()

function getKey (req) {
  return req.ip || 'unknown'
}

function sweepExpired (now) {
  for (const [key, entry] of attemptsByKey) {
    if (entry.resetAt <= now) attemptsByKey.delete(key)
  }
}

function loginRateLimiter (req, res, next) {
  const now = Date.now()
  const key = getKey(req)

  sweepExpired(now)

  const entry = attemptsByKey.get(key)

  if (!entry || entry.resetAt <= now) {
    attemptsByKey.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return next()
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000)
    res.setHeader('Retry-After', String(retryAfterSec))
    return res.status(429).json({
      error: 'Demasiados intentos',
      message: 'Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.'
    })
  }

  entry.count += 1
  return next()
}

function resetLoginAttempts (req) {
  attemptsByKey.delete(getKey(req))
}

module.exports = { loginRateLimiter, resetLoginAttempts }
