const Joi = require('joi');

const searchUsersQuerySchema = Joi.object({
  name: Joi.string().trim().max(255).allow(''),
});

const userIdParamsSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
});

// Deliberately minimal (id/name/email only) - this backs the "search
// employees to add to a team" picker, not a general user profile view.
class UserSummaryDto {
  constructor(user) {
    this.id = user.id;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.email = user.email;
  }

  static from(user) {
    return new UserSummaryDto(user);
  }

  static fromList(users) {
    return users.map((user) => UserSummaryDto.from(user));
  }
}

module.exports = { searchUsersQuerySchema, userIdParamsSchema, UserSummaryDto };
