const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middlewares/authenticate.middleware');
const validate = require('../middlewares/validate.middleware');
const { signupSchema, signinSchema } = require('../dtos/auth.dto');

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     SignupInput:
 *       type: object
 *       required: [firstName, lastName, email, password]
 *       properties:
 *         firstName: { type: string }
 *         lastName: { type: string }
 *         email: { type: string, format: email }
 *         password: { type: string, format: password, minLength: 8 }
 *         mobileNumber: { type: string }
 *     SigninInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, format: email }
 *         password: { type: string, format: password }
 *     User:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         firstName: { type: string }
 *         lastName: { type: string }
 *         email: { type: string }
 *         mobileNumber: { type: string }
 *         status: { type: string, example: ACTIVE }
 *         roles:
 *           type: array
 *           items: { type: string }
 *           example: [EMPLOYEE]
 */

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     summary: Register a new user (assigned the EMPLOYEE role by default), opening a new session
 *     description: >
 *       Creates a session capped at MAX_ACTIVE_SESSIONS_PER_USER (default 3)
 *       per user - the oldest session is evicted if the cap would be exceeded.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupInput'
 *     responses:
 *       201:
 *         description: User created, access/refresh cookies set
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already registered
 */
router.post('/signup', validate(signupSchema), authController.signup);

/**
 * @openapi
 * /auth/signin:
 *   post:
 *     summary: Sign in with email and password, opening a new session
 *     description: >
 *       Creates a session capped at MAX_ACTIVE_SESSIONS_PER_USER (default 3)
 *       per user - the oldest session is evicted if the cap would be exceeded.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SigninInput'
 *     responses:
 *       200:
 *         description: Signed in, access/refresh cookies set
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account is inactive
 */
router.post('/signin', validate(signinSchema), authController.signin);

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     summary: Exchange the refresh token cookie for a new access/refresh token pair (rotation)
 *     description: >
 *       The presented refresh token is single-use: it is marked ROTATED and a
 *       new one is issued in its place. Presenting an already-rotated or
 *       revoked token is treated as token theft (reuse detection) and
 *       immediately revokes the entire session/token family, requiring a
 *       fresh sign-in.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Tokens refreshed, new cookies set
 *       401:
 *         description: Missing, invalid, expired, or revoked/reused refresh token
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke the current session (and its token family) and clear auth cookies
 *     tags: [Auth]
 *     responses:
 *       204:
 *         description: Logged out
 */
router.post('/logout', authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the current authenticated user's profile
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, authController.me);

module.exports = router;
