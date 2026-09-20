// Calls team.service.js directly with a hand-built `requestingUser` object
// missing `permissions` entirely. Every real caller's `req.user.permissions`
// always comes from authenticate.middleware.js, which already defaults it to
// `[]` (see auth/me.test.js), so this fallback is never exercised via HTTP -
// but the service itself defends against it independently, which this proves.
const { sequelize, resetMutableTables } = require('../helpers/db');
const teamService = require('../../src/services/team.service');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('team.service.js treats a missing `permissions` array on the requester as granting none', () => {
  it('getTeamDetail', async () => {
    const created = await teamService.createTeam({ title: 'Direct Test Team' });
    await expect(teamService.getTeamDetail(created.id, { id: 999 })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('getTeamsForUser', async () => {
    await expect(teamService.getTeamsForUser(123, { id: 999 })).rejects.toMatchObject({ statusCode: 403 });
  });
});
