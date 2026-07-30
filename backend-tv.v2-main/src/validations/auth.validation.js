const { celebrate, Joi, Segments } = require("celebrate");

const loginValidation = celebrate({
  [Segments.BODY]: Joi.object({
    email: Joi.string().email().trim().lowercase().required(),
    password: Joi.string().min(8).max(128).required(),
  }),
});

const refreshValidation = celebrate({
  [Segments.COOKIES]: Joi.object({
    refresh_token: Joi.string().required(),
  }).unknown(true),
});

module.exports = {
  loginValidation,
  refreshValidation,
};
