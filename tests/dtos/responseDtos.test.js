// Pure unit tests of the response-shaping DTOs with hand-built objects, so
// both sides of every "was this association actually loaded?" branch are
// exercised without needing two different real queries.
const { UserResponseDto } = require('../../src/dtos/auth.dto');
const { TeamResponseDto } = require('../../src/dtos/team.dto');

describe('UserResponseDto', () => {
  it('shapes a user with statusInfo/roles loaded and explicit permissions', () => {
    const dto = UserResponseDto.from(
      {
        id: 1,
        firstName: 'Alice',
        lastName: 'Wonder',
        email: 'alice@example.com',
        mobileNumber: '12345',
        statusInfo: { value: 'ACTIVE' },
        roles: [{ name: 'EMPLOYEE' }, { name: 'ADMIN' }],
        createdAt: 't1',
        updatedAt: 't2',
      },
      ['team:create']
    );

    expect(dto.status).toBe('ACTIVE');
    expect(dto.roles).toEqual(['EMPLOYEE', 'ADMIN']);
    expect(dto.permissions).toEqual(['team:create']);
  });

  it('falls back to null status, empty roles, and empty permissions when not loaded/given', () => {
    const dto = UserResponseDto.from({ id: 1, firstName: 'Alice', lastName: 'Wonder', email: 'a@b.com' });

    expect(dto.status).toBeNull();
    expect(dto.roles).toEqual([]);
    expect(dto.permissions).toEqual([]);
  });
});

describe('TeamResponseDto', () => {
  it('shapes a team with statusInfo and members loaded', () => {
    const dto = TeamResponseDto.from({
      id: 1,
      title: 'Platform',
      description: 'Core platform team',
      statusInfo: { value: 'ACTIVE' },
      members: [{ id: 2, firstName: 'Alice', lastName: 'Wonder', email: 'a@b.com' }],
      createdAt: 't1',
      updatedAt: 't2',
    });

    expect(dto.status).toBe('ACTIVE');
    expect(dto.members).toEqual([{ id: 2, firstName: 'Alice', lastName: 'Wonder', email: 'a@b.com' }]);
  });

  it('nulls status and omits members entirely when neither was loaded', () => {
    const dto = TeamResponseDto.from({ id: 1, title: 'Platform', description: null });

    expect(dto.status).toBeNull();
    expect(dto.members).toBeUndefined();
  });

  it('fromList maps every team in the array', () => {
    const list = TeamResponseDto.fromList([
      { id: 1, title: 'A' },
      { id: 2, title: 'B' },
    ]);

    expect(list).toHaveLength(2);
    expect(list.map((t) => t.title)).toEqual(['A', 'B']);
  });
});
