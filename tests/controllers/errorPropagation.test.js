// These controller catch-blocks only run when the service layer throws
// something the caller didn't ask for (a genuine DB/infra failure, not a
// validation/not-found ApiError - those are already exercised end-to-end by
// every other integration test). There is no legitimate way to make a real
// database misbehave on demand for e.g. a plain, unfiltered `listTeams()`
// call, so this file mocks the service layer specifically to prove the
// plumbing (`catch (err) { next(err); }`) actually forwards such failures
// instead of hanging or throwing unhandled - it does not assert anything
// about business logic, which stays covered by the real integration suites.
jest.mock('../../src/services/auth.service');
jest.mock('../../src/services/team.service');

const authService = require('../../src/services/auth.service');
const teamService = require('../../src/services/team.service');
const authController = require('../../src/controllers/auth.controller');
const teamController = require('../../src/controllers/team.controller');
const userController = require('../../src/controllers/user.controller');

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('controllers forward unexpected service failures to next()', () => {
  it('auth.controller#logout', async () => {
    authService.logout.mockRejectedValue(new Error('boom'));
    const next = jest.fn();

    await authController.logout({ cookies: {} }, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('auth.controller#me', async () => {
    authService.getProfile.mockRejectedValue(new Error('boom'));
    const next = jest.fn();

    await authController.me({ user: { id: 1 } }, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('team.controller#list', async () => {
    teamService.listTeams.mockRejectedValue(new Error('boom'));
    const next = jest.fn();

    await teamController.list({}, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('user.controller#search', async () => {
    teamService.searchEmployees.mockRejectedValue(new Error('boom'));
    const next = jest.fn();

    await userController.search({ query: {} }, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
