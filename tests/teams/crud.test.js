const { sequelize, resetMutableTables } = require('../helpers/db');
const { signup, signupAdmin } = require('../helpers/auth');
const { createTeam, listTeams, getTeam, updateTeam, deleteTeam, addMembers } = require('../helpers/teams');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /teams', () => {
  it('lets an ADMIN create a team, defaulting to ACTIVE status', async () => {
    const { cookies } = await signupAdmin();

    const res = await createTeam(cookies.accessToken, { title: 'Platform', description: 'Core platform team' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ title: 'Platform', description: 'Core platform team', status: 'ACTIVE' });
    expect(res.body.data.id).toBeTruthy();
  });

  it('rejects a duplicate team title with 409', async () => {
    const { cookies } = await signupAdmin();
    await createTeam(cookies.accessToken, { title: 'Platform' });

    const res = await createTeam(cookies.accessToken, { title: 'Platform' });
    expect(res.status).toBe(409);
  });

  it('rejects a missing title with 400', async () => {
    const { cookies } = await signupAdmin();
    const res = await createTeam(cookies.accessToken, { description: 'no title' });
    expect(res.status).toBe(400);
  });

  it('rejects an EMPLOYEE (missing team:create) with 403', async () => {
    const { cookies } = await signup();
    const res = await createTeam(cookies.accessToken, { title: 'Platform' });
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await createTeam(undefined, { title: 'Platform' });
    expect(res.status).toBe(401);
  });

  it('returns 500 when the ACTIVE TEAM_STATUS lookup seed is missing', async () => {
    const { cookies } = await signupAdmin();
    const [[row]] = await sequelize.query("SELECT id, label FROM lookup WHERE type = 'TEAM_STATUS' AND value = 'ACTIVE'");
    await sequelize.query(`DELETE FROM lookup WHERE id = ${row.id}`);

    try {
      const res = await createTeam(cookies.accessToken, { title: 'Ghost Team' });
      expect(res.status).toBe(500);
    } finally {
      // lookup rows are seeded once by globalSetup and never truncated
      // between tests (see tests/helpers/db.js) - restore it for later tests.
      await sequelize.query(`
        INSERT INTO lookup (type, label, value, created_at, updated_at)
        VALUES ('TEAM_STATUS', '${row.label}', 'ACTIVE', NOW(), NOW())
      `);
    }
  });
});

describe('GET /teams', () => {
  it('lets an ADMIN list all teams', async () => {
    const { cookies } = await signupAdmin();
    await createTeam(cookies.accessToken, { title: 'Platform' });
    await createTeam(cookies.accessToken, { title: 'Marketing' });

    const res = await listTeams(cookies.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.map((t) => t.title).sort()).toEqual(['Marketing', 'Platform']);
  });

  it('rejects an EMPLOYEE (missing team:view_all) with 403', async () => {
    const { cookies } = await signup();
    const res = await listTeams(cookies.accessToken);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /teams/:id', () => {
  it('updates title, description, and status', async () => {
    const { cookies } = await signupAdmin();
    const created = await createTeam(cookies.accessToken, { title: 'Platform', description: 'v1' });

    const res = await updateTeam(cookies.accessToken, created.body.data.id, {
      title: 'Platform Engineering',
      description: 'v2',
      status: 'INACTIVE',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: 'Platform Engineering',
      description: 'v2',
      status: 'INACTIVE',
    });
  });

  it('clears the description when given an empty string', async () => {
    const { cookies } = await signupAdmin();
    const created = await createTeam(cookies.accessToken, { title: 'Platform', description: 'v1' });

    const res = await updateTeam(cookies.accessToken, created.body.data.id, { description: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBeNull();
  });

  it('rejects renaming to a title already used by another team with 409', async () => {
    const { cookies } = await signupAdmin();
    await createTeam(cookies.accessToken, { title: 'Platform' });
    const other = await createTeam(cookies.accessToken, { title: 'Marketing' });

    const res = await updateTeam(cookies.accessToken, other.body.data.id, { title: 'Platform' });
    expect(res.status).toBe(409);
  });

  it('rejects an empty update body with 400', async () => {
    const { cookies } = await signupAdmin();
    const created = await createTeam(cookies.accessToken, { title: 'Platform' });

    const res = await updateTeam(cookies.accessToken, created.body.data.id, {});
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent team', async () => {
    const { cookies } = await signupAdmin();
    const res = await updateTeam(cookies.accessToken, 999999, { title: 'Ghost Team' });
    expect(res.status).toBe(404);
  });

  it('rejects an EMPLOYEE (missing team:update) with 403', async () => {
    const { cookies: adminCookies } = await signupAdmin();
    const created = await createTeam(adminCookies.accessToken, { title: 'Platform' });

    const { cookies } = await signup();
    const res = await updateTeam(cookies.accessToken, created.body.data.id, { title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when the target TEAM_STATUS lookup seed is missing', async () => {
    const { cookies } = await signupAdmin();
    const created = await createTeam(cookies.accessToken, { title: 'Platform' });
    const [[row]] = await sequelize.query("SELECT id, label FROM lookup WHERE type = 'TEAM_STATUS' AND value = 'INACTIVE'");
    await sequelize.query(`DELETE FROM lookup WHERE id = ${row.id}`);

    try {
      const res = await updateTeam(cookies.accessToken, created.body.data.id, { status: 'INACTIVE' });
      expect(res.status).toBe(400);
    } finally {
      await sequelize.query(`
        INSERT INTO lookup (type, label, value, created_at, updated_at)
        VALUES ('TEAM_STATUS', '${row.label}', 'INACTIVE', NOW(), NOW())
      `);
    }
  });
});

describe('DELETE /teams/:id', () => {
  it('deletes a team', async () => {
    const { cookies } = await signupAdmin();
    const created = await createTeam(cookies.accessToken, { title: 'Platform' });

    const res = await deleteTeam(cookies.accessToken, created.body.data.id);
    expect(res.status).toBe(204);

    const after = await getTeam(cookies.accessToken, created.body.data.id);
    expect(after.status).toBe(404);
  });

  it('cascades to user_teams (membership rows are gone too)', async () => {
    const { cookies } = await signupAdmin();
    const { payload: employee } = await signup();
    const created = await createTeam(cookies.accessToken, { title: 'Platform' });
    const [[{ id: employeeId }]] = await sequelize.query(`SELECT id FROM users WHERE email = '${employee.email}'`);

    await addMembers(cookies.accessToken, created.body.data.id, [employeeId]);
    await deleteTeam(cookies.accessToken, created.body.data.id);

    const [rows] = await sequelize.query(`SELECT * FROM user_teams WHERE team_id = ${created.body.data.id}`);
    expect(rows).toHaveLength(0);
  });

  it('returns 404 for a nonexistent team', async () => {
    const { cookies } = await signupAdmin();
    const res = await deleteTeam(cookies.accessToken, 999999);
    expect(res.status).toBe(404);
  });

  it('rejects an EMPLOYEE (missing team:delete) with 403', async () => {
    const { cookies: adminCookies } = await signupAdmin();
    const created = await createTeam(adminCookies.accessToken, { title: 'Platform' });

    const { cookies } = await signup();
    const res = await deleteTeam(cookies.accessToken, created.body.data.id);
    expect(res.status).toBe(403);
  });
});
