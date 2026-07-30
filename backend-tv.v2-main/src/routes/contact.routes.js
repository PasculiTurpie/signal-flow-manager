const express = require("express");
const ContactController = require("../controllers/contact.controller");

const router = express.Router();

router
  .route("/contacts")
  .get(ContactController.getContact)
  .post(ContactController.createContact);

router
  .route("/contacts/:id")
  .get(ContactController.getIdContact)
  .put(ContactController.updateContact)
  .delete(ContactController.deleteContact);

module.exports = router;
