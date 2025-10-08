import winston from 'winston';

import { config } from '@/config';
import type { ILogger } from '@/types';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${String(timestamp)} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

const winstonLogger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    config.isDevelopment ? colorize() : winston.format.uncolorize(),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

if (config.isProduction) {
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    })
  );

  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    })
  );
}

class Logger implements ILogger {
  info(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    winstonLogger.error(message, {
      ...meta,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : undefined,
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.debug(message, meta);
  }
}

export const logger = new Logger();
