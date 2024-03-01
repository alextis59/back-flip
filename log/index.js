const os                                   = require('os'),
      correlator                           = require('correlation-id'),
      { createLogger, format, transports } = require('winston');


// a custom format that outputs correlation id
const correlationIdFormat = format((info) => {
    info.correlationId = correlator.getId();
    return info;
})();

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    exitOnError: false,
    format: format.combine(
        format.splat(),
        format.timestamp(),
        correlationIdFormat,
        format.json()
    ),
    defaultMeta: { service: 'log', host: os.hostname() },
    transports: [new transports.Console()]
});

logger.setConfig = function(service_name, level) {
    let options = {
        level: level,
        exitOnError: false,
        format: format.combine(
            format.splat(),
            format.timestamp(),
            correlationIdFormat,
            format.json()
        ),
        defaultMeta: { service: service_name, host: os.hostname() },
        transports: [new transports.Console()]
    };
    logger.configure(options);
};

module.exports = logger;
