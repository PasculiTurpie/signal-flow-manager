const express = require("express");
const UserController = require("../controllers/user.controller");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");
const { canManageUser } = require("../middleware/canManageUser");

const {
  createUserValidation,
  updateUserValidation,
} = require("../validations/user.validation");

const router = express.Router();

router.get("/users", authRequired, UserController.getAllUser);
router.get("/users/me", authRequired, UserController.getUserById);

router
  .route("/users/:id")
  .get(authRequired, UserController.getUserId)
  .put(authRequired, canManageUser, updateUserValidation, UserController.updateUser)
  .delete(authRequired, requireAdmin, UserController.deleteUser);

router.post(
  "/users",
  authRequired,
  requireAdmin,
  createUserValidation,
  UserController.createUser
);

module.exports = router;
