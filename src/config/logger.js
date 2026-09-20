const { createLogger, format, transports } = require('winston');
const path = require('path');
const { env, logLevel } = require('./env');

const logsDir = path.join(process.cwd(), 'logs');

const logger = createLogger({
  level: logLevel,
  // format.errors captures err.stack when an Error is logged directly (e.g. logger.error(err)).
  // format.splat enables printf-style calls like logger.info('%s %s', a, b), used in requestLogger.
  // format.json makes the file transports emit structured, machine-parseable lines.
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'workflow-tracking-api' },
  // File transports always run so nothing is lost when there's no console attached
  // (e.g. running under a process manager). error.log duplicates >=error entries
  // for fast incident triage without grepping the full combined log.
  transports: [
    new transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(logsDir, 'combined.log') }),
  ],
  exitOnError: false,
});

// Console output is opt-in outside production and test (Jest sets
// NODE_ENV=test by default, and its own output is noisy enough without every
// request/service-layer log line interleaved) and uses its own human-readable
// format (colorized, single line) instead of the JSON used by the file
// transports, since a developer's terminal and a log aggregator have different needs.
if (env !== 'production' && env !== 'test') {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, stack, ...meta }) => {
          // Prefer the captured stack trace over the bare message, and only
          // append extra metadata (e.g. request path) when it's actually present.
          // istanbul ignore next -- `meta` always has at least `service` from
          // `defaultMeta` above, so the empty-metadata branch is unreachable
          // as configured; kept as a guard in case defaultMeta is ever removed.
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${stack || message}${rest}`;
        })
      ),
    })
  );
}

module.exports = logger;
