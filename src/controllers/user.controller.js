const teamService = require('../services/team.service');
const { UserSummaryDto } = require('../dtos/user.dto');
const { TeamResponseDto } = require('../dtos/team.dto');

class UserController {
  async search(req, res, next) {
    try {
      const users = await teamService.searchEmployees(req.query.name);
      res.json({ success: true, data: UserSummaryDto.fromList(users) });
    } catch (err) {
      next(err);
    }
  }

  async getTeams(req, res, next) {
    try {
      const teams = await teamService.getTeamsForUser(req.params.userId, req.user);
      res.json({ success: true, data: TeamResponseDto.fromList(teams) });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
