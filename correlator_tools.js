const correlator = require('correlation-id'),
      uuid       = require('uuid'),
      logger     = require('./log');

const self = {

    newId: async (info, warn) => {
        return new Promise((resolve, reject) => {
            let previous_id = correlator.getId();
            correlator.withId(uuid.v4(), () => {
                if (warn) {
                    logger.warn("New correlation id branch", { info: info, previous_id: previous_id });
                } else {
                    logger.debug("New correlation id branch", { info: info, previous_id: previous_id });
                }
                resolve(); // Resolve the promise upon completion
            });
        });
    }

};

module.exports = self;
