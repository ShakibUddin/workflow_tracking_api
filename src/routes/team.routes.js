const { Router } = require('express');
const teamController = require('../controllers/team.controller');
const authenticate = require('../middlewares/authenticate.middleware');
const authorize = require('../middlewares/authorize.middleware');
const validate = require('../middlewares/validate.middleware');
const { PERMISSIONS } = require('../constants/auth.constants');
const {
  createTeamSchema,
  updateTeamSchema,
  addMembersSchema,
  teamIdParamsSchema,
  teamMemberParamsSchema,
} = require('../dtos/team.dto');

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     TeamInput:
 *       type: object
 *       required: [title]
 *       properties:
 *         title: { type: string }
 *         description: { type: string }
 *     Team:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         title: { type: string }
 *         description: { type: string, nullable: true }
 *         status: { type: string, example: ACTIVE }
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string }
 */

/**
 * @openapi
 * /teams:
 *   post:
 *     summary: Create a team (requires team:create)
 *     tags: [Teams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TeamInput' }
 *     responses:
 *       201: { description: Team created }
 *       409: { description: A team with this title already exists }
 *   get:
 *     summary: List all teams (requires team:view_all)
 *     tags: [Teams]
 *     responses:
 *       200: { description: List of teams }
 */
router.post('/', authenticate, authorize(PERMISSIONS.TEAM_CREATE), validate(createTeamSchema), teamController.create);
router.get('/', authenticate, authorize(PERMISSIONS.TEAM_VIEW_ALL), teamController.list);

/**
 * @openapi
 * /teams/{id}:
 *   get:
 *     summary: Get a team's detail and members - requires team:view_all, or being a member of this specific team
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Team detail }
 *       403: { description: Not a member of this team }
 *       404: { description: Team not found }
 *   patch:
 *     summary: Update a team (requires team:update)
 *     tags: [Teams]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200: { description: Team updated }
 *   delete:
 *     summary: Delete a team, including its memberships (requires team:delete)
 *     tags: [Teams]
 *     responses:
 *       204: { description: Team deleted }
 */
router.get('/:id', authenticate, validate(teamIdParamsSchema, 'params'), teamController.getById);
router.patch(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.TEAM_UPDATE),
  validate(teamIdParamsSchema, 'params'),
  validate(updateTeamSchema),
  teamController.update
);
router.delete(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.TEAM_DELETE),
  validate(teamIdParamsSchema, 'params'),
  teamController.remove
);

/**
 * @openapi
 * /teams/{id}/members:
 *   post:
 *     summary: Add one or more EMPLOYEE users to a team (requires team:manage_members)
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userIds]
 *             properties:
 *               userIds: { type: array, items: { type: integer } }
 *     responses:
 *       200: { description: Team with updated member list }
 *       400: { description: A userId doesn't exist or isn't an EMPLOYEE }
 */
router.post(
  '/:id/members',
  authenticate,
  authorize(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  validate(teamIdParamsSchema, 'params'),
  validate(addMembersSchema),
  teamController.addMembers
);

/**
 * @openapi
 * /teams/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a user from a team (requires team:manage_members)
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Team with updated member list }
 *       404: { description: User is not a member of this team }
 */
router.delete(
  '/:id/members/:userId',
  authenticate,
  authorize(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  validate(teamMemberParamsSchema, 'params'),
  teamController.removeMember
);

module.exports = router;
