const bcrypt = require('bcryptjs');
const { bcrypt: bcryptConfig } = require('../config/env');

// bcryptjs (pure JS) instead of bcrypt (native addon) - avoids requiring a
// C++ build toolchain, which matters on machines without one set up (e.g. bare Windows).
const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, bcryptConfig.saltRounds);

const comparePassword = (plainPassword, passwordHash) => bcrypt.compare(plainPassword, passwordHash);

module.exports = { hashPassword, comparePassword };
