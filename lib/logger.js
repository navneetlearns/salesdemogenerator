// lib/logger.js — Structured logging for demo-generator services
// Uses pino with file/line context capture for debuggable error traces.
// 
// Usage:
//   const log = require('./lib/logger')('build');
//   log.info({ brand: 'jk_cement' }, 'Building brand');
//   log.error({ err, brand }, 'Build failed');

const pino = require('pino');
const path = require('path');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Create a structured logger bound to a module name.
 * @param {string} module — short name identifying the source (e.g., 'build', 'adapter')
 * @returns {{ info, warn, error, debug, child }}
 */
function createLogger(module) {
  const logger = pino({
    level: LOG_LEVEL,
    name: module,
    formatters: {
      level(label) { return { level: label }; },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Pretty-print in development
    transport: process.env.NODE_ENV === 'production' ? undefined : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  });

  return {
    /**
     * @param {object} [ctx] — structured context object
     * @param {string} msg — human-readable message
     */
    info(ctx, msg) {
      if (typeof ctx === 'string') { msg = ctx; ctx = {}; }
      logger.info(ctx || {}, msg || '');
    },

    warn(ctx, msg) {
      if (typeof ctx === 'string') { msg = ctx; ctx = {}; }
      logger.warn(ctx || {}, msg || '');
    },

    error(ctx, msg) {
      if (typeof ctx === 'string') { msg = ctx; ctx = {}; }
      const enriched = { ...(ctx || {}) };
      if (enriched.err && enriched.err instanceof Error) {
        enriched.err = {
          message: enriched.err.message,
          stack: enriched.err.stack?.split('\n').slice(0, 6).join('\n'),
          code: enriched.err.code,
        };
      }
      logger.error(enriched, msg || '');
    },

    debug(ctx, msg) {
      if (typeof ctx === 'string') { msg = ctx; ctx = {}; }
      logger.debug(ctx || {}, msg || '');
    },

    /**
     * Create a child logger with additional bound context.
     */
    child(bindings) {
      const child = logger.child(bindings);
      return {
        info: (ctx, msg) => { child.info({ ...(typeof ctx === 'object' ? ctx : {}), ...bindings }, typeof ctx === 'string' ? ctx : msg); },
        warn: (ctx, msg) => { child.warn({ ...(typeof ctx === 'object' ? ctx : {}), ...bindings }, typeof ctx === 'string' ? ctx : msg); },
        error: (ctx, msg) => { child.error({ ...(typeof ctx === 'object' ? ctx : {}), ...bindings }, typeof ctx === 'string' ? ctx : msg); },
        debug: (ctx, msg) => { child.debug({ ...(typeof ctx === 'object' ? ctx : {}), ...bindings }, typeof ctx === 'string' ? ctx : msg); },
        child: createLogger(module).child,
      };
    },
  };
}

module.exports = createLogger;
