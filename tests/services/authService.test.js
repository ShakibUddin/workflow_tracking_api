// Calls authService.getProfile directly rather than through GET /auth/me:
// reaching a "user not found" state through the real endpoint isn't
// possible, since sessions.user_id cascades on delete (see the
// create-sessions migration) - deleting a user always takes their active
// session down with it, which authenticate.middleware.js would reject first
// with 401 before the service layer is ever reached.
const { sequelize, resetMutableTables } = require('../helpers/db');
const authService = require('../../src/services/auth.service');
const userRepository = require('../../src/repositories/user.repository');
const { signup } = require('../helpers/auth');

beforeEach(async () => {
  await resetMutableTables();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await sequelize.close();
});

describe('auth.service.js#getProfile', () => {
  it('throws a 404 ApiError for a user id that does not exist', async () => {
    await expect(authService.getProfile(999999)).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('treats a user with no `roles` loaded as having none', async () => {
    // userRepository.findById always eager-loads roles in real usage (see
    // its defaultIncludes) - spied here for this one call only, to reach the
    // `|| []` fallback the service defends with independently.
    const { payload } = await signup();
    const real = await userRepository.findByEmail(payload.email);
    jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ ...real.get({ plain: true }), roles: undefined });

    const { permissions } = await authService.getProfile(real.id);
    expect(permissions).toEqual([]);
  });
});

describe('auth.service.js#signin', () => {
  it('treats a user with no `roles` loaded as having none', async () => {
    const { payload } = await signup();
    const real = await userRepository.findByEmail(payload.email);
    jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce({ ...real.get({ plain: true }), roles: undefined });

    const { permissions } = await authService.signin(
      { email: payload.email, password: payload.password },
      { userAgent: null, ipAddress: null }
    );
    expect(permissions).toEqual([]);
  });
});
