const { Team, User, Lookup } = require('../models');

const statusInclude = { model: Lookup, as: 'statusInfo' };
const membersInclude = {
  model: User,
  as: 'members',
  through: { attributes: [] },
  attributes: ['id', 'firstName', 'lastName', 'email'],
};

class TeamRepository {
  async create(data, options) {
    return Team.create(data, options);
  }

  async findByTitle(title, options) {
    return Team.findOne({ where: { title }, ...options });
  }

  async findAll(options) {
    return Team.findAll({ include: [statusInclude], order: [['id', 'ASC']], ...options });
  }

  async findById(id, options) {
    return Team.findByPk(id, { include: [statusInclude, membersInclude], ...options });
  }

  // Lighter than findById: no member list, just enough to check
  // existence/update/delete without paying for the members join.
  async findByIdBasic(id, options) {
    return Team.findByPk(id, options);
  }

  async findByUserId(userId, options) {
    return Team.findAll({
      include: [
        statusInclude,
        { model: User, as: 'members', where: { id: userId }, attributes: [], through: { attributes: [] } },
      ],
      order: [['id', 'ASC']],
      ...options,
    });
  }

  async addMembers(team, users, options) {
    return team.addMembers(users, options);
  }

  async removeMember(team, userId, options) {
    return team.removeMembers([userId], options);
  }
}

module.exports = new TeamRepository();
