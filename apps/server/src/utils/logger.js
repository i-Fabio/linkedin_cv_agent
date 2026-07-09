import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

function timestamp() {
  return new Date().toISOString();
}

function writeToAppLog(line) {
  fs.appendFileSync(path.join(config.logsDir, 'app.log'), line + '\n');
}

export const logger = {
  info(message, meta) {
    const line = `[${timestamp()}] [INFO] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;
    console.log(line);
    writeToAppLog(line);
  },
  error(message, meta) {
    const line = `[${timestamp()}] [ERROR] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;
    console.error(line);
    writeToAppLog(line);
  },
};

// Logger dedicado a un run de extraccion (usado desde la Fase 3 en adelante).
export function createRunLogger(runId) {
  const logPath = path.join(config.logsDir, `run-${runId}.log`);

  function append(level, message) {
    const line = `[${timestamp()}] [${level}] ${message}`;
    fs.appendFileSync(logPath, line + '\n');
    return line;
  }

  return {
    logPath,
    info: (message) => append('INFO', message),
    warn: (message) => append('WARN', message),
    error: (message) => append('ERROR', message),
  };
}

export function readRunLog(logPath) {
  if (!logPath || !fs.existsSync(logPath)) {
    return [];
  }
  return fs
    .readFileSync(logPath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0);
}
