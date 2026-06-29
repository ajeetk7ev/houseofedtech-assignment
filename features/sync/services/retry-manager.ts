export interface RetryConfig {
  maxRetries: number;
  minDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 5,
  minDelayMs: 1000, // Start with 1s
  maxDelayMs: 30000, // Max 30s
  jitterFactor: 0.2, // 20% random variance
};

export class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculates the delay (in milliseconds) before the next retry.
   */
  getBackoffDelay(retryCount: number): number {
    if (retryCount <= 0) return 0;
    
    // Exponential backoff: baseDelay * 2^retryCount
    const expDelay = this.config.minDelayMs * Math.pow(2, retryCount - 1);
    const cappedDelay = Math.min(expDelay, this.config.maxDelayMs);
    
    // Add randomized jitter to avoid collision sync storms
    const jitterAmount = cappedDelay * this.config.jitterFactor;
    const randomJitter = (Math.random() * 2 - 1) * jitterAmount; // Range [-jitter, +jitter]
    
    return Math.max(0, cappedDelay + randomJitter);
  }

  /**
   * Checks if an operation can be retried.
   */
  shouldRetry(retryCount: number): boolean {
    return retryCount < this.config.maxRetries;
  }

  /**
   * Helper that executes a callback after the appropriate backoff period.
   */
  scheduleRetry(callback: () => void, retryCount: number): NodeJS.Timeout | null {
    if (!this.shouldRetry(retryCount)) return null;

    const delay = this.getBackoffDelay(retryCount);
    return setTimeout(callback, delay);
  }
}

export const retryManager = new RetryManager();
