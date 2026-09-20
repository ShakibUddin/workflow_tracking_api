const authService = require('../services/auth.service');
const { UserResponseDto } = require('../dtos/auth.dto');
const { setAuthCookies, clearAuthCookies } = require('../utils/cookies');

// Recorded on the session row (sessions.user_agent / ip_address) purely for
// the user's own visibility/audit trail - never used for any access decision.
const requestContext = (req) => ({
  userAgent: req.get('user-agent') || null,
  ipAddress: req.ip,
});

class AuthController {
  async signup(req, res, next) {
    try {
      const { user, tokens, permissions } = await authService.signup(req.body, requestContext(req));
      setAuthCookies(res, tokens);
      res.status(201).json({ success: true, data: UserResponseDto.from(user, permissions) });
    } catch (err) {
      next(err);
    }
  }

  async signin(req, res, next) {
    try {
      const { user, tokens, permissions } = await authService.signin(req.body, requestContext(req));
      setAuthCookies(res, tokens);
      res.json({ success: true, data: UserResponseDto.from(user, permissions) });
    } catch (err) {
      next(err);
    }
  }

  // Not gated by authenticate: must still clear a stale/leaked refresh token
  // even if the access token cookie is already expired or missing.
  async logout(req, res, next) {
    try {
      await authService.logout(req.cookies?.refreshToken);
      clearAuthCookies(res);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const tokens = await authService.refreshTokens(req.cookies?.refreshToken);
      setAuthCookies(res, tokens);
      res.json({ success: true, message: 'Token refreshed' });
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      const { user, permissions } = await authService.getProfile(req.user.id);
      res.json({ success: true, data: UserResponseDto.from(user, permissions) });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
