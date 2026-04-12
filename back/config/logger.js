'use strict';

const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');

const { combine, timestamp, printf, colorize, errors } = format;

// ── 로그 포맷 ──────────────────────────────────────────────────────
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return stack
    ? `[${timestamp}] ${level}: ${message}\n${stack}`
    : `[${timestamp}] ${level}: ${message}`;
});

const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

// ── Transport 정의 ─────────────────────────────────────────────────
const errorRotate = new DailyRotateFile({
  dirname:       LOG_DIR,
  filename:      'error-%DATE%.log',
  datePattern:   'YYYY-MM-DD',
  level:         'error',
  maxSize:       '20m',
  maxFiles:      '30d',
  zippedArchive: true,
  format:        fileFormat,
});

const combinedRotate = new DailyRotateFile({
  dirname:       LOG_DIR,
  filename:      'combined-%DATE%.log',
  datePattern:   'YYYY-MM-DD',
  maxSize:       '20m',
  maxFiles:      '14d',
  zippedArchive: true,
  format:        fileFormat,
});

// ── Logger 생성 ────────────────────────────────────────────────────
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    errorRotate,
    combinedRotate,
  ],
});

// 개발 환경에서만 콘솔 출력
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({ format: consoleFormat }));
}

// morgan 스트림 (HTTP 요청 로그 → winston info)
logger.stream = {
  write: (message) => logger.info(message.trimEnd()),
};

module.exports = logger;