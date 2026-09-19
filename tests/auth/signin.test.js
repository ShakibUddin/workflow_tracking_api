const request = require('supertest');
const { sequelize, resetMutableTables } = require('../helpers/db');
const { app, signup, signin, DEFAULT_PASSWORD } = require('../helpers/auth');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /auth/signin', () => {
  it('signs in with correct credentials and opens a new session', async () => {
    const { payload } = await signup();

    const { res, cookies } = await signin({ email: payload.email, password: payload.password });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(payload.email);
    expect(cookies.accessToken).toBeTruthy();
    expect(cookies.refreshToken).toBeTruthy();

    const [[{ count }]] = await sequelize.query(
      `SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = '${payload.email}' AND s.status = 'ACTIVE'`
    );
    expect(count).toBe(2); // one from signup, one from this signin
  });

  it('rejects a wrong password with 401 without revealing which field was wrong', async () => {
    const { payload } = await signup();
    const { res } = await signin({ email: payload.email, password: 'WrongPassword123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('rejects a nonexistent email with 401', async () => {
    const { res } = await signin({ email: 'nobody@example.com', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects sign-in for an inactive account with 403', async () => {
    const { payload } = await signup();
    await sequelize.query(`
      UPDATE users SET status = (SELECT id FROM lookup WHERE type = 'USER_STATUS' AND value = 'INACTIVE')
      WHERE email = '${payload.email}'
    `);

    const { res } = await signin({ email: payload.email, password: payload.password });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/inactive/i);
  });

  it('rejects a missing password with 400 validation error', async () => {
    const res = await request(app).post('/api/v1/auth/signin').send({ email: 'a@example.com' });
    expect(res.status).toBe(400);
  });
});
