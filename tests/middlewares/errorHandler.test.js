// Pure unit test of the exported error-mapping functions with fabricated
// inputs (fake req/res, hand-built error objects) - no DB, no app. This is
// the only reasonable way to exercise the raw-Sequelize-error normalization
// branches, since every real integration flow already converts DB failures
// into an ApiError before they'd reach this middleware (see DECISIONS.md).
const ApiError = require('../../src/utils/ApiError');
const logger = require('../../src/config/logger');
const { errorHandler, notFoundHandler } = require('../../src/middlewares/errorHandler.middleware');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('errorHandler.middleware.js', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a known ApiError straight through with its status/message/details', () => {
    const res = mockRes();
    errorHandler(ApiError.badRequest('bad input', ['field is required']), { originalUrl: '/x' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'bad input',
      details: ['field is required'],
    });
  });

  it('normalizes SequelizeUniqueConstraintError to a 409 using its own message', () => {
    const res = mockRes();
    const err = { name: 'SequelizeUniqueConstraintError', errors: [{ message: 'email must be unique' }] };
    errorHandler(err, { originalUrl: '/x' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'email must be unique' }));
  });

  it('falls back to a generic conflict message when the Sequelize error carries no detail', () => {
    const res = mockRes();
    errorHandler({ name: 'SequelizeUniqueConstraintError' }, { originalUrl: '/x' }, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Resource already exists' }));
  });

  it('normalizes SequelizeValidationError to a 400 with a details array', () => {
    const res = mockRes();
    const err = { name: 'SequelizeValidationError', errors: [{ message: 'title is required' }] };
    errorHandler(err, { originalUrl: '/x' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ details: ['title is required'] }));
  });

  it('masks an unrecognized error as a generic 500 and logs it at error level', () => {
    const logSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const res = mockRes();
    errorHandler(new Error('raw driver failure'), { originalUrl: '/y' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Internal server error' });
    expect(logSpy).toHaveBeenCalledWith('raw driver failure', expect.objectContaining({ path: '/y' }));
  });

  it('logs a known 4xx ApiError at warn level, not error', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    errorHandler(ApiError.notFound('nope'), { originalUrl: '/z' }, mockRes(), jest.fn());

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('notFoundHandler forwards a 404 ApiError describing the unmatched route', () => {
    const next = jest.fn();
    notFoundHandler({ method: 'GET', originalUrl: '/nope' }, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'Route not found: GET /nope' }));
  });
});
