import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Handles application logging with file rotation and multiple log levels
 */
export class Logger {
  private logFile: string;
  private debugEnabled: boolean = false;

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
   * Enable or disable debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.debug(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if debug mode is enabled
   */
  public isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  /**
   * Log a message with the specified level
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
   * Log a debug message
   */
  public debug(message: string): void {
    this.log(message, 'debug');
  }

  /**
   * Log an info message
   */
  public info(message: string): void {
    this.log(message, 'info');
  }

  /**
   * Log a warning message
   */
  public warn(message: string): void {
    this.log(message, 'warn');
  }

  /**
   * Log an error message
   */
  public error(message: string): void {
    this.log(message, 'error');
  }
}
