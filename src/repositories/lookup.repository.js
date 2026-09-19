const { Lookup } = require('../models');

class LookupRepository {
  async findByTypeAndValue(type, value) {
    return Lookup.findOne({ where: { type, value } });
  }
}

module.exports = new LookupRepository();
