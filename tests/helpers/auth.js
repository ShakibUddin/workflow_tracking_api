const request = require('supertest');
const app = require('../../src/app');
const { parseCookies } = require('./cookies');

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

module.exports = { app, DEFAULT_PASSWORD, buildUser, signup, signin, refresh, logout, me };
