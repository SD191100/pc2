import { config } from "../config/index.js";
import winston from "winston";

const { combine, timestamp, json, printf, colorize } = winston.format;

// Development format: human-readable with colors
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : "";
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Production format: JSON for structured logging
const prodFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  json()
);

const logger = winston.createLogger({
  level: config.log || "info",
  transports: [],
});

if (config.env !== "production") {
  // Development: console with colors and readable format
  logger.add(
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        devFormat
      ),
    })
  );
} else {
  // Production: file with JSON format
  logger.add(
    new winston.transports.File({
      filename: "logs/app.log",
      format: prodFormat,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: prodFormat,
    })
  );
}

export default logger;
