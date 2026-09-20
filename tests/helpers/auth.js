const request = require('supertest');
const app = require('../../src/app');
const { parseCookies } = require('./cookies');
const { sequelize } = require('../../src/models');

const DEFAULT_PASSWORD = 'SuperSecret123';

const buildUser = (overrides = {}) => ({
  firstName: 'Test',
  lastName: 'User',
  email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
  password: DEFAULT_PASSWORD,
  ...overrides,
});

const signup = async (overrides = {}) => {
  const payload = buildUser(overrides);
  const res = await request(app).post('/api/v1/auth/signup').send(payload);
  return { res, cookies: parseCookies(res.headers['set-cookie']), payload };
};

const signin = async ({ email, password }) => {
  const res = await request(app).post('/api/v1/auth/signin').send({ email, password });
  return { res, cookies: parseCookies(res.headers['set-cookie']) };
};

const refresh = async (refreshToken) => {
  const res = await request(app)
    .post('/api/v1/auth/refresh-token')
    .set('Cookie', refreshToken ? [`refreshToken=${refreshToken}`] : []);
  return { res, cookies: parseCookies(res.headers['set-cookie']) };
};

const logout = async (refreshToken) => {
  const res = await request(app)
    .post('/api/v1/auth/logout')
    .set('Cookie', refreshToken ? [`refreshToken=${refreshToken}`] : []);
  return { res };
};

const me = async (accessToken) => {
  const res = await request(app)
    .get('/api/v1/auth/me')
    .set('Cookie', accessToken ? [`accessToken=${accessToken}`] : []);
  return { res };
};

// Signs up a normal EMPLOYEE, then swaps EMPLOYEE for ADMIN directly via SQL
// (there's no self-service way to become ADMIN - see DECISIONS.md Q18) so
// the result is a clean ADMIN-only user, not a dual-role ADMIN+EMPLOYEE one -
// tests that assert "an ADMIN can't be added to a team" depend on that.
// Finally signs in again so the returned token actually carries the new
// role/permissions (both are resolved and embedded at token-issue time, not
// re-checked per request - see Q34).
const signupAdmin = async (overrides = {}) => {
  const { payload } = await signup(overrides);
  await sequelize.query(`
    UPDATE user_roles SET role_id = (SELECT id FROM roles WHERE name = 'ADMIN')
    WHERE user_id = (SELECT id FROM users WHERE email = '${payload.email}')
  `);
  const { res, cookies } = await signin({ email: payload.email, password: payload.password });
  return { res, cookies, payload };
};

module.exports = { app, DEFAULT_PASSWORD, buildUser, signup, signin, refresh, logout, me, signupAdmin };
