const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/authenticate.middleware');
const authorize = require('../middlewares/authorize.middleware');
const validate = require('../middlewares/validate.middleware');
const { PERMISSIONS } = require('../constants/auth.constants');
const { searchUsersQuerySchema, userIdParamsSchema } = require('../dtos/user.dto');

const router = Router();

/**
 * @openapi
 * /users/search:
 *   get:
 *     summary: Search EMPLOYEE users by name, for the "add to team" picker (requires team:manage_members)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *     responses:
 *       200: { description: Matching EMPLOYEE users }
 */
router.get(
  '/search',
  authenticate,
  authorize(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  validate(searchUsersQuerySchema, 'query'),
  userController.search
);

/**
 * @openapi
 * /users/{userId}/teams:
 *   get:
 *     summary: List a user's teams - only that user themself, or an admin (team:view_all), may call this
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Teams the user belongs to }
 *       403: { description: Not allowed to view another user's teams }
 */
router.get('/:userId/teams', authenticate, validate(userIdParamsSchema, 'params'), userController.getTeams);

module.exports = router;
