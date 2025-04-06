const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create logger instance
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // Adjust level for prod
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    new transports.Console({ // Log only to console
      format: combine(colorize(), logFormat)
    })
    // Remove file transports for Vercel compatibility
    // new transports.File({ 
    //   filename: 'bot.log',
    //   maxsize: 5 * 1024 * 1024, // 5MB
    //   maxFiles: 3
    // })
  ]
});

// Handle uncaught exceptions - Console is usually sufficient
// logger.exceptions.handle(
//   new transports.File({ filename: 'exceptions.log' })
// );
// Consider adding a console transport for exceptions if needed
logger.exceptions.handle(
  new transports.Console({ format: combine(colorize(), logFormat) })
);

module.exports = logger;