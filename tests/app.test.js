const request = require('supertest');
const app = require('../src/app');

describe('GET /api/v1/health', () => {
  it('returns 200 with a success payload', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'OK' });
    expect(res.body.timestamp).toBeTruthy();
  });
});

describe('unmatched routes', () => {
  it('returns a 404 with a consistent error shape via notFoundHandler', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
    expect(res.body.message).toMatch(/route not found/i);
  });
});

describe('Swagger docs', () => {
  it('serves the docs UI at /api-docs', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
  });
});
