/**
 * Handles connection attempt state and computes backoff timings using
 * exponential backoff with randomized jitter to prevent synchronization thundering herds.
 */
export class ReconnectManager {
  private attempt = 0;
  private maxAttempts = 5;
  private baseDelay = 1500; // 1.5 seconds
  private maxDelay = 15000; // 15 seconds max

  constructor(options?: { maxAttempts?: number; baseDelay?: number; maxDelay?: number }) {
    if (options?.maxAttempts !== undefined) this.maxAttempts = options.maxAttempts;
    if (options?.baseDelay !== undefined) this.baseDelay = options.baseDelay;
    if (options?.maxDelay !== undefined) this.maxDelay = options.maxDelay;
  }

  /**
   * Reset reconnect attempt counter on successful connection.
   */
  reset(): void {
    this.attempt = 0;
  }

  /**
   * Increments the attempt counter and returns the next delay in milliseconds.
   */
  getNextDelay(): number {
    this.attempt++;
    if (this.attempt > this.maxAttempts) {
      return -1; // Stop trying
    }

    // Exponential backoff: baseDelay * 2^(attempt - 1)
    const factor = Math.pow(2, this.attempt - 1);
    const rawDelay = Math.min(this.maxDelay, this.baseDelay * factor);

    // Full jitter: randomize between 0 and rawDelay
    const jitteredDelay = Math.random() * rawDelay;

    return Math.floor(jitteredDelay);
  }

  get currentAttempts(): number {
    return this.attempt;
  }

  get isMaxedOut(): boolean {
    return this.attempt >= this.maxAttempts;
  }
}
