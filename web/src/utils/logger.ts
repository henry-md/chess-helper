import { NODE_ENV } from "@/env";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  level: LogLevel;
  enabled: boolean;
}

class Logger {
  private options: LoggerOptions;
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: options.level || (NODE_ENV === 'development' ? 'debug' : 'warn'),
      enabled: options.enabled ?? NODE_ENV === 'development',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.options.enabled && this.levels[level] >= this.levels[this.options.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const date = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const timestamp = `${formattedHours}:${formattedMinutes}${period}`;
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${args.join(' ')}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string | Error, ...args: any[]): void {
    if (this.shouldLog('error')) {
      const errorMessage = message instanceof Error ? message.message : message;
      console.error(this.formatMessage('error', errorMessage), ...args);
      
      // Optional: Send errors to your error tracking service
      if (import.meta.env.PROD) {
        // Example: Sentry.captureException(message);
      }
    }
  }
}

// Create a singleton instance
const logger = new Logger();

export default logger;
