const teamService = require('../services/team.service');
const { TeamResponseDto } = require('../dtos/team.dto');

class TeamController {
  async create(req, res, next) {
    try {
      const team = await teamService.createTeam(req.body);
      res.status(201).json({ success: true, data: TeamResponseDto.from(team) });
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const teams = await teamService.listTeams();
      res.json({ success: true, data: TeamResponseDto.fromList(teams) });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const team = await teamService.getTeamDetail(req.params.id, req.user);
      res.json({ success: true, data: TeamResponseDto.from(team) });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const team = await teamService.updateTeam(req.params.id, req.body);
      res.json({ success: true, data: TeamResponseDto.from(team) });
    } catch (err) {
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      await teamService.deleteTeam(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async addMembers(req, res, next) {
    try {
      const team = await teamService.addMembers(req.params.id, req.body.userIds);
      res.json({ success: true, data: TeamResponseDto.from(team) });
    } catch (err) {
      next(err);
    }
  }

  async removeMember(req, res, next) {
    try {
      const team = await teamService.removeMember(req.params.id, req.params.userId);
      res.json({ success: true, data: TeamResponseDto.from(team) });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TeamController();
