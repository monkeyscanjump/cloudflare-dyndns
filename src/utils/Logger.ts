import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Handles application logging with console and file output
 * Supports multiple severity levels and automatic log directory creation
 */
export class Logger {
  private logFile: string;
  private debugEnabled: boolean = false;

  /**
   * Creates a new logger instance
   * @param logFile Path to the log file where messages will be stored
   */
  constructor(logFile: string) {
    this.logFile = logFile;

    // Create log directory if it doesn't exist
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create log directory ${logDir}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Enables or disables debug-level logging
   * @param enabled Whether debug messages should be logged
   */
  public setDebugMode(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.debug(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Checks if debug mode is currently enabled
   * @returns True if debug logging is enabled
   */
  public isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  /**
   * Logs a message with the specified severity level
   * Writes to both console and log file
   * @param message Message text to log
   * @param level Severity level of the message
   */
  public log(message: string, level: LogLevel = 'info'): void {
    // Skip debug messages if debug mode is not enabled
    if (level === 'debug' && !this.debugEnabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;

    // Always output to console
    if (level === 'error') {
      console.error(formattedMessage);
    } else if (level === 'warn') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // Write to log file
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error(`Failed to write to log file ${this.logFile}: ${(error as Error).message}`);
    }
  }

  /**
   * Logs a debug-level message
   * Only logged if debug mode is enabled
   * @param message Debug message to log
   */
  public debug(message: string): void {
    this.log(message, 'debug');
  }

  /**
   * Logs an informational message
   * @param message Info message to log
   */
  public info(message: string): void {
    this.log(message, 'info');
  }

  /**
   * Logs a warning message
   * @param message Warning message to log
   */
  public warn(message: string): void {
    this.log(message, 'warn');
  }

  /**
   * Logs an error message
   * @param message Error message to log
   */
  public error(message: string): void {
    this.log(message, 'error');
  }
}
