// Mocks team.repository/user.repository to fabricate partially-loaded
// associations that team.repository.js and user.repository.js's own
// `include`s never actually produce in real usage (both always eager-load
// `members`/`roles` - see their defaultIncludes), so the `|| []` fallbacks in
// team.service.js that guard against a missing association can't otherwise
// be exercised.
jest.mock('../../src/repositories/team.repository');
jest.mock('../../src/repositories/user.repository');

const teamRepository = require('../../src/repositories/team.repository');
const userRepository = require('../../src/repositories/user.repository');
const teamService = require('../../src/services/team.service');

afterEach(() => {
  jest.clearAllMocks();
});

describe('team.service.js defensive fallbacks for partially-loaded associations', () => {
  it('treats a team with no `members` loaded as having none (isMemberOf, via removeMember)', async () => {
    teamRepository.findById.mockResolvedValue({ id: 1, title: 'X' }); // `members` intentionally omitted

    await expect(teamService.removeMember(1, 999)).rejects.toMatchObject({
      statusCode: 404,
      message: 'User is not a member of this team',
    });
  });

  it('treats a user with no `roles` loaded as not holding EMPLOYEE (addMembers)', async () => {
    teamRepository.findById.mockResolvedValue({ id: 1, title: 'X', members: [] });
    userRepository.findById.mockResolvedValue({ id: 55 }); // `roles` intentionally omitted

    await expect(teamService.addMembers(1, [55])).rejects.toMatchObject({
      statusCode: 400,
      message: 'Only users with the EMPLOYEE role can be added to a team',
    });
  });
});
