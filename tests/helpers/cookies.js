// supertest doesn't keep a cookie jar like a browser (or curl -b/-c) would -
// these turn a raw Set-Cookie header array into a {name: value} map, and
// back into a Cookie header string to attach to the next request.
const parseCookies = (setCookieHeader = []) => {
  const cookies = {};
  for (const raw of setCookieHeader) {
    const pair = raw.split(';')[0];
    const idx = pair.indexOf('=');
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return cookies;
};

const cookieHeader = (cookies) =>
  Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

// True if a Set-Cookie header for `name` clears it (Max-Age=0 / expired) -
// used to assert logout actually clears the cookies, not just that it returned 204.
const isCleared = (setCookieHeader = [], name) => {
  const line = setCookieHeader.find((raw) => raw.startsWith(`${name}=`));
  if (!line) return false;
  return /Max-Age=0/i.test(line) || /Expires=Thu, 01 Jan 1970/i.test(line);
};

module.exports = { parseCookies, cookieHeader, isCleared };
