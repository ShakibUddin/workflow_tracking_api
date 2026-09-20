const { sequelize, resetMutableTables } = require('../helpers/db');
const roleRepository = require('../../src/repositories/role.repository');
const userRepository = require('../../src/repositories/user.repository');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('role.repository.js#findPermissionNamesByRoleNames', () => {
  it('short-circuits to an empty array without querying when given no role names', async () => {
    expect(await roleRepository.findPermissionNamesByRoleNames([])).toEqual([]);
    expect(await roleRepository.findPermissionNamesByRoleNames(undefined)).toEqual([]);
  });

  it('tolerates a role whose permissions association was not loaded', async () => {
    // A caller-supplied `options` overrides the default `include`, e.g.
    // `{ include: [] }` - `role.permissions` is then undefined per role
    // rather than an (empty) array, which the `|| []` fallback guards against.
    const names = await roleRepository.findPermissionNamesByRoleNames(['EMPLOYEE'], { include: [] });
    expect(names).toEqual([]);
  });
});

describe('user.repository.js#search', () => {
  it('matches on role alone when no name filter is given', async () => {
    const results = await userRepository.search({ roleName: 'EMPLOYEE' });
    expect(Array.isArray(results)).toBe(true);
  });

  it('defaults its filter object when called with no filter at all', async () => {
    // `include: []` strips the role-name include, which would otherwise
    // build a `WHERE name = undefined` clause Postgres rejects - unrelated
    // to the thing under test, which is just the `{ name, roleName } = {}`
    // default parameter kicking in for a fully-omitted first argument.
    const results = await userRepository.search(undefined, { include: [] });
    expect(Array.isArray(results)).toBe(true);
  });
});
