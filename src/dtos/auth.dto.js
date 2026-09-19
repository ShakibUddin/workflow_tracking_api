const Joi = require('joi');

const signupSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().trim().lowercase().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  mobileNumber: Joi.string().trim().max(30).allow('', null),
});

const signinSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

/**
 * Shapes a User model instance into the response payload sent to clients.
 * Deliberately whitelists fields - password and refreshToken are never
 * copied here, so they can never leak regardless of what a query loaded.
 */
class UserResponseDto {
  constructor(user) {
    this.id = user.id;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.email = user.email;
    this.mobileNumber = user.mobileNumber;
    this.status = user.statusInfo ? user.statusInfo.value : null;
    this.roles = (user.roles || []).map((role) => role.name);
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }

  static from(user) {
    return new UserResponseDto(user);
  }
}

module.exports = { signupSchema, signinSchema, UserResponseDto };
