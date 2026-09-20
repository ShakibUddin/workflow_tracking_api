const ApiError = require('../../src/utils/ApiError');

describe('ApiError', () => {
  it.each([
    ['badRequest', 400],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['notFound', 404],
    ['conflict', 409],
    ['internal', 500],
  ])('%s() builds a %i error with the given message', (method, statusCode) => {
    const err = ApiError[method]('message');
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.statusCode).toBe(statusCode);
    expect(err.message).toBe('message');
  });

  it('unauthorized() and forbidden() default their message when none is given', () => {
    expect(ApiError.unauthorized().message).toBe('Unauthorized');
    expect(ApiError.forbidden().message).toBe('Forbidden');
  });

  it('carries optional details (e.g. a validation error list)', () => {
    expect(ApiError.badRequest('Validation failed', ['field required']).details).toEqual(['field required']);
  });

  it('has no details by default', () => {
    expect(ApiError.notFound('missing').details).toBeNull();
  });
});
