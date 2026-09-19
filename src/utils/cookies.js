const { env } = require('../config/env');
const { getTokenExpiryMs } = require('./jwt');

const baseCookieOptions = {
  httpOnly: true,
  secure: env === 'production',
  sameSite: 'strict',
};

// The refresh token cookie is scoped to /api/v1/auth so the browser only ever
// sends it to auth endpoints, not on every request to the API - the access
// token cookie is scoped to '/' since every request needs it for authenticate.middleware.js.
const ACCESS_COOKIE_PATH = '/';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

// refreshTokenExpiresAt is passed in explicitly (the exact Date stored on the
// refresh_tokens row) rather than decoded, since the refresh token is now an
// opaque random string with no embedded expiry to decode.
const setAuthCookies = (res, { accessToken, refreshToken, refreshTokenExpiresAt }) => {
  res.cookie('accessToken', accessToken, {
    ...baseCookieOptions,
    path: ACCESS_COOKIE_PATH,
    maxAge: getTokenExpiryMs(accessToken) - Date.now(),
  });
  res.cookie('refreshToken', refreshToken, {
    ...baseCookieOptions,
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshTokenExpiresAt.getTime() - Date.now(),
  });
};

// clearCookie must be called with the same path the cookie was set with, or
// the browser won't recognize it as the same cookie and won't remove it.
const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { ...baseCookieOptions, path: ACCESS_COOKIE_PATH });
  res.clearCookie('refreshToken', { ...baseCookieOptions, path: REFRESH_COOKIE_PATH });
};

module.exports = { setAuthCookies, clearAuthCookies };
