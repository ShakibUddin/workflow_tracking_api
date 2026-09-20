const teamRepository = require('../repositories/team.repository');
const userRepository = require('../repositories/user.repository');
const lookupRepository = require('../repositories/lookup.repository');
const ApiError = require('../utils/ApiError');
const { LOOKUP_TYPES, TEAM_STATUS, ROLES, PERMISSIONS } = require('../constants/auth.constants');

const isMemberOf = (team, userId) => (team.members || []).some((member) => String(member.id) === String(userId));

class TeamService {
  async createTeam({ title, description }) {
    const existing = await teamRepository.findByTitle(title);
    if (existing) {
      throw ApiError.conflict('A team with this title already exists');
    }

    const activeStatus = await lookupRepository.findByTypeAndValue(LOOKUP_TYPES.TEAM_STATUS, TEAM_STATUS.ACTIVE);
    if (!activeStatus) {
      throw ApiError.internal('Required lookup seed data is missing. Run the seeders.');
    }

    const team = await teamRepository.create({
      title,
      description: description || null,
      teamStatusId: activeStatus.id,
    });
    return teamRepository.findById(team.id);
  }

  async updateTeam(teamId, { title, description, status }) {
    const team = await teamRepository.findByIdBasic(teamId);
    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    if (title !== undefined && title !== team.title) {
      const existing = await teamRepository.findByTitle(title);
      if (existing) {
        throw ApiError.conflict('A team with this title already exists');
      }
      team.title = title;
    }

    if (description !== undefined) {
      team.description = description || null;
    }

    if (status !== undefined) {
      const statusLookup = await lookupRepository.findByTypeAndValue(LOOKUP_TYPES.TEAM_STATUS, status);
      if (!statusLookup) {
        throw ApiError.badRequest('Invalid team status');
      }
      team.teamStatusId = statusLookup.id;
    }

    await team.save();
    return teamRepository.findById(teamId);
  }

  async deleteTeam(teamId) {
    const team = await teamRepository.findByIdBasic(teamId);
    if (!team) {
      throw ApiError.notFound('Team not found');
    }
    // Cascades user_teams at the DB level (see the create-user-teams migration).
    await team.destroy();
  }

  async listTeams() {
    return teamRepository.findAll();
  }

  // ADMIN (team:view_all) can view any team; anyone else must actually be a
  // member - a resource-level check the coarse `authorize` middleware can't
  // express, so it lives here instead of on the route.
  async getTeamDetail(teamId, requestingUser) {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    const canViewAny = (requestingUser.permissions || []).includes(PERMISSIONS.TEAM_VIEW_ALL);
    if (!canViewAny && !isMemberOf(team, requestingUser.id)) {
      throw ApiError.forbidden('You are not a member of this team');
    }

    return team;
  }

  async addMembers(teamId, userIds) {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    const newUserIds = userIds.filter((userId) => !isMemberOf(team, userId));
    if (newUserIds.length === 0) {
      return team;
    }

    const users = await Promise.all(newUserIds.map((userId) => userRepository.findById(userId)));
    const missingIndex = users.findIndex((user) => !user);
    if (missingIndex !== -1) {
      throw ApiError.notFound(`User not found: ${newUserIds[missingIndex]}`);
    }

    const nonEmployees = users.filter((user) => !(user.roles || []).some((role) => role.name === ROLES.EMPLOYEE));
    if (nonEmployees.length > 0) {
      throw ApiError.badRequest('Only users with the EMPLOYEE role can be added to a team');
    }

    await teamRepository.addMembers(team, users);
    return teamRepository.findById(teamId);
  }

  async removeMember(teamId, userId) {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    if (!isMemberOf(team, userId)) {
      throw ApiError.notFound('User is not a member of this team');
    }

    await teamRepository.removeMember(team, userId);
    return teamRepository.findById(teamId);
  }

  // A user may only ever list their own teams unless they hold team:view_all
  // - otherwise anyone could enumerate anyone else's team membership just by
  // guessing a userId.
  async getTeamsForUser(userId, requestingUser) {
    const canViewAny = (requestingUser.permissions || []).includes(PERMISSIONS.TEAM_VIEW_ALL);
    if (String(requestingUser.id) !== String(userId) && !canViewAny) {
      throw ApiError.forbidden('You can only view your own teams');
    }

    return teamRepository.findByUserId(userId);
  }

  async searchEmployees(name) {
    return userRepository.search({ name, roleName: ROLES.EMPLOYEE });
  }
}

module.exports = new TeamService();
