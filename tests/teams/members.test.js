const { sequelize, resetMutableTables } = require('../helpers/db');
const { signup, signupAdmin } = require('../helpers/auth');
const { createTeam, getTeam, addMembers, removeMember } = require('../helpers/teams');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /teams/:id/members', () => {
  it('adds one or more EMPLOYEE users to a team', async () => {
    const { cookies } = await signupAdmin();
    const alice = await signup({ firstName: 'Alice', lastName: 'Wonder' });
    const bob = await signup({ firstName: 'Bob', lastName: 'Builder' });
    const team = await createTeam(cookies.accessToken, { title: 'Platform' });

    const res = await addMembers(cookies.accessToken, team.body.data.id, [
      alice.res.body.data.id,
      bob.res.body.data.id,
    ]);

    expect(res.status).toBe(200);
    expect(res.body.data.members.map((m) => m.email).sort()).toEqual(
      [alice.res.body.data.email, bob.res.body.data.email].sort()
    );
  });

  it('adding an already-existing member again is a no-op, not an error', async () => {
    const { cookies } = await signupAdmin();
    const alice = await signup({ firstName: 'Alice', lastName: 'Wonder' });
    const team = await createTeam(cookies.accessToken, { title: 'Platform' });

    await addMembers(cookies.accessToken, team.body.data.id, [alice.res.body.data.id]);
    const res = await addMembers(cookies.accessToken, team.body.data.id, [alice.res.body.data.id]);

    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(1);
  });

  it('rejects adding a non-EMPLOYEE (e.g. another ADMIN) with 400', async () => {
    const { cookies } = await signupAdmin();
    const otherAdmin = await signupAdmin();
    const team = await createTeam(cookies.accessToken, { title: 'Platform' });

    const res = await addMembers(cookies.accessToken, team.body.data.id, [otherAdmin.res.body.data.id]);
    expect(res.status).toBe(400);
  });

  it('rejects a nonexistent userId with 404', async () => {
    const { cookies } = await signupAdmin();
    const team = await createTeam(cookies.accessToken, { title: 'Platform' });

    const res = await addMembers(cookies.accessToken, team.body.data.id, [999999]);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent team', async () => {
    const { cookies } = await signupAdmin();
    const alice = await signup();

    const res = await addMembers(cookies.accessToken, 999999, [alice.res.body.data.id]);
    expect(res.status).toBe(404);
  });

  it('rejects an EMPLOYEE (missing team:manage_members) with 403', async () => {
    const { cookies: adminCookies } = await signupAdmin();
    const team = await createTeam(adminCookies.accessToken, { title: 'Platform' });
    const alice = await signup();

    const { cookies } = await signup();
    const res = await addMembers(cookies.accessToken, team.body.data.id, [alice.res.body.data.id]);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /teams/:id/members/:userId', () => {
  it('removes a member from a team', async () => {
    const { cookies } = await signupAdmin();
    const alice = await signup();
    const team = await createTeam(cookies.accessToken, { title: 'Platform' });
    await addMembers(cookies.accessToken, team.body.data.id, [alice.res.body.data.id]);

    const res = await removeMember(cookies.accessToken, team.body.data.id, alice.res.body.data.id);

    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(0);
  });

  it('returns 404 when the user is not a member of the team', async () => {
    const { cookies } = await signupAdmin();
    const alice = await signup();
    const team = await createTeam(cookies.accessToken, { title: 'Platform' });

    const res = await removeMember(cookies.accessToken, team.body.data.id, alice.res.body.data.id);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent team', async () => {
    const { cookies } = await signupAdmin();
    const res = await removeMember(cookies.accessToken, 999999, 1);
    expect(res.status).toBe(404);
  });

  it('rejects an EMPLOYEE (missing team:manage_members) with 403', async () => {
    const { cookies: adminCookies } = await signupAdmin();
    const alice = await signup();
    const team = await createTeam(adminCookies.accessToken, { title: 'Platform' });
    await addMembers(adminCookies.accessToken, team.body.data.id, [alice.res.body.data.id]);

    const { cookies } = await signup();
    const res = await removeMember(cookies.accessToken, team.body.data.id, alice.res.body.data.id);
    expect(res.status).toBe(403);
  });
});

describe('GET /teams/:id member visibility', () => {
  it('a member of the team can view its detail', async () => {
    const { cookies: adminCookies } = await signupAdmin();
    const alice = await signup();
    const team = await createTeam(adminCookies.accessToken, { title: 'Platform' });
    await addMembers(adminCookies.accessToken, team.body.data.id, [alice.res.body.data.id]);

    const res = await getTeam(alice.cookies.accessToken, team.body.data.id);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Platform');
  });

  it('a non-member EMPLOYEE cannot view the team detail', async () => {
    const { cookies: adminCookies } = await signupAdmin();
    const team = await createTeam(adminCookies.accessToken, { title: 'Platform' });
    const outsider = await signup();

    const res = await getTeam(outsider.cookies.accessToken, team.body.data.id);
    expect(res.status).toBe(403);
  });

  it('an ADMIN (team:view_all) can view any team even without being a member', async () => {
    const { cookies } = await signupAdmin();
    const team = await createTeam(cookies.accessToken, { title: 'Platform' });

    const res = await getTeam(cookies.accessToken, team.body.data.id);
    expect(res.status).toBe(200);
  });

  it('returns 404 for a nonexistent team', async () => {
    const { cookies } = await signupAdmin();
    const res = await getTeam(cookies.accessToken, 999999);
    expect(res.status).toBe(404);
  });
});
