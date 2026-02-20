import { VERSION } from "./version";
import { TruelistError, AuthenticationError, RateLimitError, ApiError } from "./errors";
import type {
  TruelistOptions,
  ValidateOptions,
  ValidationResult,
  AccountInfo,
  ApiValidationResponse,
  ApiAccountResponse,
} from "./types";

const DEFAULT_BASE_URL = "https://api.truelist.io";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function toValidationResult(raw: ApiValidationResponse): ValidationResult {
  return {
    email: raw.email,
    state: raw.state,
    subState: raw.sub_state,
    freeEmail: raw.free_email,
    role: raw.role,
    disposable: raw.disposable,
    suggestion: raw.suggestion,
  };
}

class Truelist {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  email: {
    validate: (email: string, options?: ValidateOptions) => Promise<ValidationResult>;
    formValidate: (email: string, options?: ValidateOptions) => Promise<ValidationResult>;
  };

  account: {
    get: () => Promise<AccountInfo>;
  };

  constructor(apiKey: string, options?: TruelistOptions) {
    if (!apiKey) {
      throw new TruelistError(
        "An API key is required. Pass it as the first argument: new Truelist('your-api-key')"
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

    this.email = {
      validate: (email: string, opts?: ValidateOptions) => this.validateEmail(email, opts),
      formValidate: (email: string, opts?: ValidateOptions) => this.formValidateEmail(email, opts),
    };

    this.account = {
      get: () => this.getAccount(),
    };
  }

  private async validateEmail(email: string, options?: ValidateOptions): Promise<ValidationResult> {
    const raw = await this.request<ApiValidationResponse>("POST", "/api/v1/verify", { email }, options?.signal);
    return toValidationResult(raw);
  }

  private async formValidateEmail(email: string, options?: ValidateOptions): Promise<ValidationResult> {
    const raw = await this.request<ApiValidationResponse>("POST", "/api/v1/form_verify", { email }, options?.signal);
    return toValidationResult(raw);
  }

  private async getAccount(): Promise<AccountInfo> {
    const raw = await this.request<ApiAccountResponse>("GET", "/api/v1/account");
    return {
      email: raw.email,
      plan: raw.plan,
      credits: raw.credits,
    };
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `truelist-node/${VERSION}`,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Wait before retrying (not on first attempt)
      if (attempt > 0) {
        const delay = this.getRetryDelay(attempt, lastError);
        await this.sleep(delay);
      }

      // Create a timeout abort controller that composes with the user's signal
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), this.timeout);

      // If the user passed a signal, abort our controller when theirs fires
      const onUserAbort = () => timeoutController.abort();
      signal?.addEventListener("abort", onUserAbort, { once: true });

      try {
        const fetchOptions: RequestInit = {
          method,
          headers,
          signal: timeoutController.signal,
        };

        if (body && method !== "GET") {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);

        if (response.ok) {
          return (await response.json()) as T;
        }

        // Parse error body
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text().catch(() => null);
        }

        // Handle specific status codes
        if (response.status === 401) {
          throw new AuthenticationError();
        }

        if (response.status === 429) {
          const retryAfterHeader = response.headers.get("Retry-After");
          const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
          const error = new RateLimitError(undefined, Number.isNaN(retryAfter) ? undefined : retryAfter);

          // Retry if we have attempts left
          if (attempt < this.maxRetries) {
            lastError = error;
            continue;
          }
          throw error;
        }

        // Retry on 5xx errors
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
          lastError = new ApiError(
            `API request failed with status ${response.status}`,
            response.status,
            errorBody
          );
          continue;
        }

        const message =
          typeof errorBody === "object" && errorBody !== null && "message" in errorBody
            ? String((errorBody as { message: unknown }).message)
            : `API request failed with status ${response.status}`;

        throw new ApiError(message, response.status, errorBody);
      } catch (error: unknown) {
        // Don't retry non-retryable errors
        if (
          error instanceof AuthenticationError ||
          (error instanceof ApiError && !RETRYABLE_STATUS_CODES.has(error.status))
        ) {
          throw error;
        }

        // Handle abort (user-initiated cancellation)
        if (signal?.aborted) {
          throw new TruelistError("Request was cancelled");
        }

        // Handle timeout (AbortError from our timeout controller)
        if (
          error instanceof DOMException && error.name === "AbortError"
        ) {
          lastError = new TruelistError(`Request timed out after ${this.timeout}ms`);
          if (attempt < this.maxRetries) {
            continue;
          }
          throw lastError;
        }

        // Network errors — retry if possible
        if (error instanceof TypeError && attempt < this.maxRetries) {
          lastError = new TruelistError(`Network error: ${error.message}`);
          continue;
        }

        // Re-throw TruelistError subclasses as-is
        if (error instanceof TruelistError) {
          throw error;
        }

        // Wrap unexpected errors
        if (error instanceof Error) {
          throw new TruelistError(error.message);
        }

        throw new TruelistError("An unexpected error occurred");
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onUserAbort);
      }
    }

    // If we exhausted all retries
    throw lastError ?? new TruelistError("Request failed after all retries");
  }

  private getRetryDelay(attempt: number, lastError?: Error): number {
    // If we have a Retry-After from a 429, use it
    if (lastError instanceof RateLimitError && lastError.retryAfter) {
      return lastError.retryAfter * 1000;
    }

    // Exponential backoff: 500ms, 1000ms, 2000ms, ... with jitter
    const baseDelay = 500 * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 100;
    return baseDelay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default Truelist;
