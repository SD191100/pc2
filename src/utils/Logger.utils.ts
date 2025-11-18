import { config } from "../config/index.js";
import winston from "winston";

const { combine, timestamp, json, printf, colorize } = winston.format;

const consoleFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`
});

const devFormat = {
  format: combine(
    colorize(),
    timestamp({ format: `DD-MM-YYYY mm:HH:ss` }),
    consoleFormat
  )
}

const logger = winston.createLogger({
  level: config.log || 'info',
  format: combine(timestamp(), json()),
  transports: [],
});


if (config.env !== 'production') {
  logger.add(new winston.transports.Console(devFormat));
} else {
  logger.add(new winston.transports.File({
    filename: `logs/app.log`,
    format: winston.format.json()
  }))
}

export default logger;
