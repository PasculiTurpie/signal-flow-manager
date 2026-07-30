const { celebrate, Joi, Segments } = require("celebrate");

const baseSchema = {
  username: Joi.string().trim().min(3).max(64),
  email: Joi.string().email().trim().lowercase(),
  password: Joi.string().min(8).max(128),
  profilePicture: Joi.string().uri().trim().allow(""),
  role: Joi.string().trim().max(32),
};

const createUserValidation = celebrate({
  [Segments.BODY]: Joi.object({
    ...baseSchema,
    username: baseSchema.username.required(),
    email: baseSchema.email.required(),
    password: baseSchema.password.required(),
  }),
});

const updateUserValidation = celebrate({
  [Segments.BODY]: Joi.object(baseSchema).min(1),
});

module.exports = {
  createUserValidation,
  updateUserValidation,
};
