const request = require('supertest');
const { sequelize, resetMutableTables } = require('../helpers/db');
const { app, signup, buildUser } = require('../helpers/auth');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /auth/signup', () => {
  it('creates a user, assigns EMPLOYEE by default, and opens a session', async () => {
    const { res, cookies, payload } = await signup();

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      status: 'ACTIVE',
      roles: ['EMPLOYEE'],
    });
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();

    expect(cookies.accessToken).toBeTruthy();
    expect(cookies.refreshToken).toBeTruthy();

    const [[userRow]] = await sequelize.query(
      `SELECT id, password FROM users WHERE email = '${payload.email}'`
    );
    expect(userRow.password).not.toBe(payload.password); // hashed, not plaintext

    const [roleRows] = await sequelize.query(
      `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ${userRow.id}`
    );
    expect(roleRows.map((r) => r.name)).toEqual(['EMPLOYEE']);

    const [sessionRows] = await sequelize.query(`SELECT status FROM sessions WHERE user_id = ${userRow.id}`);
    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0].status).toBe('ACTIVE');
  });

  it('stores the refresh token only as a hash, never the raw value', async () => {
    const { cookies } = await signup();

    const [[tokenRow]] = await sequelize.query('SELECT token_hash FROM refresh_tokens LIMIT 1');
    expect(tokenRow.token_hash).not.toBe(cookies.refreshToken);
    expect(tokenRow.token_hash).toHaveLength(64); // sha256 hex digest
    expect(cookies.refreshToken.length).toBeGreaterThanOrEqual(120); // 64 random bytes, hex-encoded
  });

  it('sets both cookies as httpOnly, with the refresh cookie scoped to /api/v1/auth', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send(buildUser());

    const setCookie = res.headers['set-cookie'];
    const accessLine = setCookie.find((c) => c.startsWith('accessToken='));
    const refreshLine = setCookie.find((c) => c.startsWith('refreshToken='));

    expect(accessLine).toMatch(/HttpOnly/i);
    expect(refreshLine).toMatch(/HttpOnly/i);
    expect(refreshLine).toMatch(/Path=\/api\/v1\/auth/i);
  });

  it('rejects a duplicate email with 409', async () => {
    const { payload } = await signup();
    const { res } = await signup({ email: payload.email });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it.each([
    ['missing email', { email: undefined }],
    ['invalid email format', { email: 'not-an-email' }],
    ['password too short', { password: 'short' }],
    ['missing firstName', { firstName: undefined }],
  ])('rejects %s with 400', async (_label, overrides) => {
    const { res } = await signup(overrides);
    expect(res.status).toBe(400);
    expect(res.body.details).toBeInstanceOf(Array);
  });

  it('sanity check: required seed data (roles, lookup values) is present', async () => {
    const [lookupRows] = await sequelize.query("SELECT value FROM lookup WHERE type = 'USER_STATUS'");
    expect(lookupRows.map((r) => r.value).sort()).toEqual(['ACTIVE', 'INACTIVE']);
    const [roleRows] = await sequelize.query('SELECT name FROM roles');
    expect(roleRows.map((r) => r.name).sort()).toEqual(['ADMIN', 'EMPLOYEE']);
  });
});
