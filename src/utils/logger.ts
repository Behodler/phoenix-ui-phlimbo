/**
 * Global Logging Utility for Phoenix UI
 *
 * This utility provides structured logging with enable/disable functionality
 * to replace scattered console.log statements throughout the codebase.
 *
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Environment-based auto-configuration (enabled in dev, disabled in production)
 * - Optional context parameter for categorizing logs
 * - Type-safe factory pattern
 * - Zero console clutter in production builds
 *
 * @example
 * // Basic usage with default logger (auto-enabled in dev)
 * import { log } from '@/utils/logger';
 * log.debug('User action', { action: 'click', button: 'submit' });
 *
 * @example
 * // Create context-specific logger
 * import { createLogger } from '@/utils/logger';
 * const apiLogger = createLogger({ context: 'API' });
 * apiLogger.info('Fetching contract addresses');
 *
 * @example
 * // Manually control logging
 * const debugLogger = createLogger({ enabled: true, context: 'Debug' });
 * debugLogger.warn('This always logs regardless of environment');
 */

/**
 * Available log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Configuration options for creating a logger instance
 */
export interface LoggerOptions {
  /**
   * Whether logging is enabled. If not specified, defaults to import.meta.env.DEV
   * (automatically enabled in development, disabled in production)
   */
  enabled?: boolean;

  /**
   * Optional context string to prefix all log messages.
   * Useful for categorizing logs by feature area (e.g., 'Network', 'Vault', 'Admin')
   */
  context?: string;
}

/**
 * Logger interface with methods for each log level
 */
export interface Logger {
  /**
   * Log a debug message (lowest priority)
   * @param message - The main log message
   * @param data - Optional additional data to log
   */
  debug(message: string, ...data: any[]): void;

  /**
   * Log an informational message
   * @param message - The main log message
   * @param data - Optional additional data to log
   */
  info(message: string, ...data: any[]): void;

  /**
   * Log a warning message
   * @param message - The main log message
   * @param data - Optional additional data to log
   */
  warn(message: string, ...data: any[]): void;

  /**
   * Log an error message (highest priority)
   * @param message - The main log message
   * @param data - Optional additional data to log
   */
  error(message: string, ...data: any[]): void;
}

/**
 * Creates a logger instance with the specified configuration
 *
 * @param options - Configuration options or boolean for simple enabled/disabled control
 * @returns A logger object with methods for each log level
 *
 * @example
 * // Auto-detect environment
 * const logger = createLogger();
 *
 * @example
 * // With context
 * const networkLogger = createLogger({ context: 'Network' });
 * networkLogger.info('Detected network:', networkId);
 *
 * @example
 * // Force enable/disable
 * const forceEnabled = createLogger({ enabled: true });
 * const forceDisabled = createLogger({ enabled: false });
 *
 * @example
 * // Simple boolean parameter
 * const simpleLogger = createLogger(true);
 */
export function createLogger(options?: boolean | LoggerOptions): Logger {
  // Normalize options: if boolean provided, convert to LoggerOptions
  const config: LoggerOptions = typeof options === 'boolean'
    ? { enabled: options }
    : options || {};

  // Default to environment-based detection if enabled not specified
  const isEnabled = config.enabled !== undefined
    ? config.enabled
    : import.meta.env.DEV;

  // Build context prefix if provided
  const contextPrefix = config.context ? `[${config.context}]` : '';

  /**
   * Internal helper to log at a specific level
   */
  const logAtLevel = (
    level: LogLevel,
    consoleFn: (...args: any[]) => void,
    message: string,
    ...data: any[]
  ): void => {
    if (!isEnabled) return;

    const levelTag = `[${level.toUpperCase()}]`;
    const prefix = contextPrefix
      ? `${contextPrefix} ${levelTag}`
      : levelTag;

    if (data.length > 0) {
      consoleFn(prefix, message, ...data);
    } else {
      consoleFn(prefix, message);
    }
  };

  return {
    debug(message: string, ...data: any[]): void {
      logAtLevel(LogLevel.DEBUG, console.log, message, ...data);
    },

    info(message: string, ...data: any[]): void {
      logAtLevel(LogLevel.INFO, console.info, message, ...data);
    },

    warn(message: string, ...data: any[]): void {
      logAtLevel(LogLevel.WARN, console.warn, message, ...data);
    },

    error(message: string, ...data: any[]): void {
      logAtLevel(LogLevel.ERROR, console.error, message, ...data);
    }
  };
}

/**
 * Default logger instance for convenient importing
 * Automatically enabled in development, disabled in production
 *
 * @example
 * import { log } from '@/utils/logger';
 *
 * log.debug('Debug message');
 * log.info('Information');
 * log.warn('Warning!');
 * log.error('Error occurred', errorObject);
 */
export const log = createLogger({enabled:false});

/**
 * Usage Guidelines
 * ================
 *
 * When to Use Logger vs Console
 * ------------------------------
 * - Use logger for development/debugging information that should be silent in production
 * - Use console.error for critical errors that should always be visible
 * - Use console.warn for important warnings that should always be visible
 *
 * Respecting Story 059 Intent
 * ----------------------------
 * Story 059 removed console.log clutter to clean up production output.
 * This logger respects that intent by:
 * - Automatically disabling in production builds (import.meta.env.DEV check)
 * - Providing structured logging that can be easily toggled
 * - Supporting context-based categorization for better organization
 *
 * Environment Handling
 * --------------------
 * - Development: Logging automatically enabled (import.meta.env.DEV === true)
 * - Production: Logging automatically disabled (import.meta.env.DEV === false)
 * - Manual override: Pass { enabled: true/false } to createLogger()
 *
 * Migration from console.log
 * --------------------------
 * Old pattern:
 *   console.log('Network detected:', networkId);
 *
 * New pattern:
 *   import { createLogger } from '@/utils/logger';
 *   const networkLogger = createLogger({ context: 'Network' });
 *   networkLogger.info('Detected network:', networkId);
 *
 * Or use the default logger:
 *   import { log } from '@/utils/logger';
 *   log.info('Network detected:', networkId);
 */
