const jwt = require('jsonwebtoken');
const { sequelize, resetMutableTables } = require('../helpers/db');
const { signup, signin, refresh, me } = require('../helpers/auth');
const authorize = require('../../src/middlewares/authorize.middleware');
const { PERMISSIONS } = require('../../src/constants/auth.constants');

const ADMIN_PERMISSIONS = Object.values(PERMISSIONS).sort();

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

// Grants the ADMIN role directly via SQL (bypassing any API) to simulate an
// admin action taken after the user already has a session/token.
const promoteToAdmin = async (email) => {
  await sequelize.query(`
    INSERT INTO user_roles (user_id, role_id, created_at, updated_at)
    SELECT u.id, r.id, NOW(), NOW()
    FROM users u, roles r
    WHERE u.email = '${email}' AND r.name = 'ADMIN'
  `);
};

describe('RBAC: permissions resolved from roles->role_permissions->permissions', () => {
  it('a default EMPLOYEE signup gets an empty permission list and it is embedded in the JWT', async () => {
    const { res, cookies } = await signup();

    expect(res.body.data.permissions).toEqual([]);

    const payload = jwt.decode(cookies.accessToken);
    expect(payload.permissions).toEqual([]);
  });

  it('an ADMIN user receives every seeded permission, both in the sign-in response and inside the JWT', async () => {
    const { payload } = await signup();
    await promoteToAdmin(payload.email);

    const { res, cookies } = await signin({ email: payload.email, password: payload.password });

    expect(res.body.data.permissions.slice().sort()).toEqual(ADMIN_PERMISSIONS);
    const decoded = jwt.decode(cookies.accessToken);
    expect(decoded.permissions.slice().sort()).toEqual(ADMIN_PERMISSIONS);
  });

  it('GET /me reflects a role/permission change immediately, even with the original (pre-promotion) access token', async () => {
    const { cookies, payload } = await signup();
    await promoteToAdmin(payload.email);

    const { res } = await me(cookies.accessToken);

    expect(res.body.data.roles.slice().sort()).toEqual(['ADMIN', 'EMPLOYEE']);
    expect(res.body.data.permissions.slice().sort()).toEqual(ADMIN_PERMISSIONS);
  });

  it('rotating the refresh token re-resolves permissions from the DB, picking up a role change made since login', async () => {
    const { cookies: stage1, payload } = await signup();
    await promoteToAdmin(payload.email);

    const { cookies: stage2 } = await refresh(stage1.refreshToken);
    const decoded = jwt.decode(stage2.accessToken);

    expect(decoded.permissions.slice().sort()).toEqual(ADMIN_PERMISSIONS);
  });
});

describe('authorize.middleware.js (unit)', () => {
  const buildRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

  it('calls next() with no error when the user has every required permission', () => {
    const req = { user: { permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.ROLE_MANAGE] } };
    const next = jest.fn();

    authorize(PERMISSIONS.USER_MANAGE)(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ApiError.forbidden) when a required permission is missing', () => {
    const req = { user: { permissions: [PERMISSIONS.USER_MANAGE] } };
    const next = jest.fn();

    authorize(PERMISSIONS.SESSION_MANAGE)(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('requires every listed permission, not just one of them', () => {
    const req = { user: { permissions: [PERMISSIONS.USER_MANAGE] } };
    const next = jest.fn();

    authorize(PERMISSIONS.USER_MANAGE, PERMISSIONS.SESSION_MANAGE)(req, buildRes(), next);

    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('treats a missing req.user.permissions as an empty list rather than throwing', () => {
    const req = { user: {} };
    const next = jest.fn();

    authorize(PERMISSIONS.USER_MANAGE)(req, buildRes(), next);

    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
});
