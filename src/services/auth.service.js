const { sequelize } = require('../models');
const userRepository = require('../repositories/user.repository');
const roleRepository = require('../repositories/role.repository');
const lookupRepository = require('../repositories/lookup.repository');
const tokenService = require('./token.service');
const { hashPassword, comparePassword } = require('../utils/password');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { ROLES, LOOKUP_TYPES, USER_STATUS } = require('../constants/auth.constants');

class AuthService {
  async signup(payload, context) {
    // Checked up front (in addition to the DB unique constraint) so a
    // duplicate email fails fast with a clear 409 before paying bcrypt's
    // deliberately expensive hashing cost.
    const existing = await userRepository.findByEmail(payload.email);
    if (existing) {
      throw ApiError.conflict('Email is already registered');
    }

    const [activeStatus, employeeRole] = await Promise.all([
      lookupRepository.findByTypeAndValue(LOOKUP_TYPES.USER_STATUS, USER_STATUS.ACTIVE),
      roleRepository.findByName(ROLES.EMPLOYEE),
    ]);

    if (!activeStatus || !employeeRole) {
      // Seed data is missing - a deployment/setup problem, not something the client did.
      throw ApiError.internal('Required lookup/role seed data is missing. Run the seeders.');
    }

    const passwordHash = await hashPassword(payload.password);

    // User creation, role assignment, and the first session/token issuance
    // all happen atomically: a signup can never leave behind a user with no
    // role or no way to sign in.
    const { userId, tokens } = await sequelize.transaction(async (transaction) => {
      const created = await userRepository.create(
        {
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          password: passwordHash,
          mobileNumber: payload.mobileNumber || null,
          status: activeStatus.id,
        },
        { transaction }
      );
      await created.addRole(employeeRole, { transaction });

      const issuedTokens = await tokenService.issueSessionTokens(
        created.id,
        [employeeRole.name],
        context,
        transaction
      );

      return { userId: created.id, tokens: issuedTokens };
    });

    logger.info('User registered', { id: userId });

    const user = await userRepository.findById(userId);
    return { user, tokens };
  }

  async signin({ email, password }, context) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.statusInfo && user.statusInfo.value !== USER_STATUS.ACTIVE) {
      throw ApiError.forbidden('Account is inactive');
    }

    const roles = (user.roles || []).map((role) => role.name);
    const tokens = await sequelize.transaction((transaction) =>
      tokenService.issueSessionTokens(user.id, roles, context, transaction)
    );

    logger.info('User signed in', { id: user.id });
    return { user, tokens };
  }

  async logout(refreshToken) {
    await tokenService.revokeByRawToken(refreshToken);
  }

  async refreshTokens(refreshToken) {
    return tokenService.rotate(refreshToken);
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return user;
  }
}

module.exports = new AuthService();
