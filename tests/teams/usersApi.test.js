const { sequelize, resetMutableTables } = require('../helpers/db');
const { signup, signupAdmin } = require('../helpers/auth');
const { createTeam, addMembers, searchUsers, getUserTeams } = require('../helpers/teams');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('GET /users/search', () => {
  it('finds EMPLOYEE users by a case-insensitive partial name match', async () => {
    const { cookies } = await signupAdmin();
    await signup({ firstName: 'Alice', lastName: 'Wonder' });
    await signup({ firstName: 'Bob', lastName: 'Builder' });

    const res = await searchUsers(cookies.accessToken, 'ali');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ firstName: 'Alice', lastName: 'Wonder' });
    expect(res.body.data[0].password).toBeUndefined();
  });

  it('never returns ADMIN users, only EMPLOYEE', async () => {
    const { cookies } = await signupAdmin({ firstName: 'Zoe', lastName: 'Admin' });
    await signup({ firstName: 'Zoe', lastName: 'Employee' });

    const res = await searchUsers(cookies.accessToken, 'Zoe');

    expect(res.status).toBe(200);
    expect(res.body.data.map((u) => u.lastName)).toEqual(['Employee']);
  });

  it('rejects an EMPLOYEE (missing team:manage_members) with 403', async () => {
    const { cookies } = await signup();
    const res = await searchUsers(cookies.accessToken, 'a');
    expect(res.status).toBe(403);
  });
});

describe('GET /users/:userId/teams', () => {
  it('lets a user fetch their own teams', async () => {
    const { cookies: adminCookies } = await signupAdmin();
    const alice = await signup();
    const team = await createTeam(adminCookies.accessToken, { title: 'Platform' });
    await addMembers(adminCookies.accessToken, team.body.data.id, [alice.res.body.data.id]);

    const res = await getUserTeams(alice.cookies.accessToken, alice.res.body.data.id);

    expect(res.status).toBe(200);
    expect(res.body.data.map((t) => t.title)).toEqual(['Platform']);
  });

  it('an ADMIN (team:view_all) can fetch any user\'s teams', async () => {
    const { cookies: adminCookies } = await signupAdmin();
    const alice = await signup();
    const team = await createTeam(adminCookies.accessToken, { title: 'Platform' });
    await addMembers(adminCookies.accessToken, team.body.data.id, [alice.res.body.data.id]);

    const res = await getUserTeams(adminCookies.accessToken, alice.res.body.data.id);

    expect(res.status).toBe(200);
    expect(res.body.data.map((t) => t.title)).toEqual(['Platform']);
  });

  it('rejects a user fetching another user\'s teams with 403', async () => {
    const alice = await signup();
    const bob = await signup();

    const res = await getUserTeams(alice.cookies.accessToken, bob.res.body.data.id);
    expect(res.status).toBe(403);
  });

  it('returns an empty array for a user in no teams', async () => {
    const alice = await signup();
    const res = await getUserTeams(alice.cookies.accessToken, alice.res.body.data.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
