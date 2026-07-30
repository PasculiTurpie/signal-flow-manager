const express = require("express");
const {
  login,
  refresh,
  logout,
  profile,
} = require("../controllers/auth.controller.js");
const { authRequired } = require("../middleware/authRequired.js");
const { loginRateLimiter } = require("../middleware/loginRateLimiter.js");
const {
  loginValidation,
  refreshValidation,
} = require("../validations/auth.validation");

const router = express.Router();

router.post("/login", loginRateLimiter, loginValidation, login);
router.post("/refresh", refreshValidation, refresh);
router.get("/me", authRequired, profile);
router.post("/logout", logout);

module.exports = router;
