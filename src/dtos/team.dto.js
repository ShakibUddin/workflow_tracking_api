const Joi = require('joi');

const createTeamSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(5000).allow('', null),
});

// At least one field required - an empty PATCH body is a client mistake, not
// a valid "no-op update".
const updateTeamSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().max(5000).allow('', null),
  status: Joi.string().valid('ACTIVE', 'INACTIVE'),
}).min(1);

const addMembersSchema = Joi.object({
  userIds: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
});

const teamIdParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const teamMemberParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  userId: Joi.number().integer().positive().required(),
});

/**
 * Shapes a Team model instance (with its `statusInfo` lookup eager-loaded,
 * and optionally its `members` association) into the response payload.
 * `members` is only included when the caller actually loaded it, so the
 * list endpoint stays light and the detail endpoint stays complete.
 */
class TeamResponseDto {
  constructor(team) {
    this.id = team.id;
    this.title = team.title;
    this.description = team.description;
    this.status = team.statusInfo ? team.statusInfo.value : null;
    this.createdAt = team.createdAt;
    this.updatedAt = team.updatedAt;
    if (team.members !== undefined) {
      this.members = team.members.map((member) => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      }));
    }
  }

  static from(team) {
    return new TeamResponseDto(team);
  }

  static fromList(teams) {
    return teams.map((team) => TeamResponseDto.from(team));
  }
}

module.exports = {
  createTeamSchema,
  updateTeamSchema,
  addMembersSchema,
  teamIdParamsSchema,
  teamMemberParamsSchema,
  TeamResponseDto,
};
