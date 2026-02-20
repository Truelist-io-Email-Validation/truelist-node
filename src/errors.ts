export class TruelistError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "TruelistError";
    this.status = status;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends TruelistError {
  readonly status = 401 as const;

  constructor(message = "Invalid API key. Check your Truelist API key and try again.") {
    super(message, 401);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RateLimitError extends TruelistError {
  readonly status = 429 as const;
  readonly retryAfter?: number;

  constructor(message = "Rate limit exceeded. Please slow down your requests.", retryAfter?: number) {
    super(message, 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ApiError extends TruelistError {
  override readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message, status);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
