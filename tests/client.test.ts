import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Truelist, {
  TruelistError,
  AuthenticationError,
  RateLimitError,
  ApiError,
  isValid,
  isInvalid,
  isDisposable,
  isRole,
} from "../src/index";
import type { ValidationResult, AccountInfo } from "../src/index";

const API_KEY = "test_api_key_123";

const mockValidationResponse = {
  emails: [
    {
      address: "user@example.com",
      domain: "example.com",
      canonical: "user",
      mx_record: null,
      first_name: null,
      last_name: null,
      email_state: "ok",
      email_sub_state: "email_ok",
      verified_at: "2026-02-21T10:00:00.000Z",
      did_you_mean: null,
    },
  ],
};

const mockAccountResponse = {
  email: "team@company.com",
  name: "Team Lead",
  uuid: "a3828d19-1234-5678-9abc-def012345678",
  time_zone: "America/New_York",
  is_admin_role: true,
  token: "test_token",
  api_keys: [],
  account: {
    name: "Company Inc",
    payment_plan: "pro",
    users: [],
  },
};

function createMockResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("Truelist", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("throws when no API key is provided", () => {
      expect(() => new Truelist("")).toThrow(TruelistError);
      expect(() => new Truelist("")).toThrow("API key is required");
    });

    it("creates a client with default options", () => {
      const client = new Truelist(API_KEY);
      expect(client).toBeInstanceOf(Truelist);
      expect(client.email).toBeDefined();
      expect(client.account).toBeDefined();
    });

    it("accepts custom options", () => {
      const client = new Truelist(API_KEY, {
        baseUrl: "https://custom.api.com",
        timeout: 5000,
        maxRetries: 0,
      });
      expect(client).toBeInstanceOf(Truelist);
    });
  });

  describe("email.validate", () => {
    it("sends a POST request to /api/v1/verify_inline with email as query param", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockValidationResponse));

      const client = new Truelist(API_KEY);
      await client.email.validate("user@example.com");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://api.truelist.io/api/v1/verify_inline?email=user%40example.com"
      );
      expect(options.method).toBe("POST");
      expect(options.body).toBeUndefined();
    });

    it("sends the correct auth header", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockValidationResponse));

      const client = new Truelist(API_KEY);
      await client.email.validate("user@example.com");

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${API_KEY}`);
    });

    it("sends a User-Agent header", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockValidationResponse));

      const client = new Truelist(API_KEY);
      await client.email.validate("user@example.com");

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["User-Agent"]).toMatch(/^truelist-node\//);
    });

    it("maps API response fields to SDK properties", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockValidationResponse));

      const client = new Truelist(API_KEY);
      const result: ValidationResult = await client.email.validate("user@example.com");

      expect(result.email).toBe("user@example.com");
      expect(result.domain).toBe("example.com");
      expect(result.canonical).toBe("user");
      expect(result.mxRecord).toBeNull();
      expect(result.firstName).toBeNull();
      expect(result.lastName).toBeNull();
      expect(result.state).toBe("ok");
      expect(result.subState).toBe("email_ok");
      expect(result.verifiedAt).toBe("2026-02-21T10:00:00.000Z");
      expect(result.suggestion).toBeNull();
    });

    it("uses custom baseUrl", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockValidationResponse));

      const client = new Truelist(API_KEY, { baseUrl: "https://custom.api.com/" });
      await client.email.validate("user@example.com");

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://custom.api.com/api/v1/verify_inline?email=user%40example.com"
      );
    });

    it("strips trailing slashes from baseUrl", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockValidationResponse));

      const client = new Truelist(API_KEY, { baseUrl: "https://custom.api.com///" });
      await client.email.validate("user@example.com");

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://custom.api.com/api/v1/verify_inline?email=user%40example.com"
      );
    });
  });

  describe("account.get", () => {
    it("sends a GET request to /me", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockAccountResponse));

      const client = new Truelist(API_KEY);
      await client.account.get();

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.truelist.io/me");
      expect(options.method).toBe("GET");
    });

    it("returns account info", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockAccountResponse));

      const client = new Truelist(API_KEY);
      const account: AccountInfo = await client.account.get();

      expect(account.email).toBe("team@company.com");
      expect(account.name).toBe("Team Lead");
      expect(account.uuid).toBe("a3828d19-1234-5678-9abc-def012345678");
      expect(account.timeZone).toBe("America/New_York");
      expect(account.isAdminRole).toBe(true);
      expect(account.account.name).toBe("Company Inc");
      expect(account.account.paymentPlan).toBe("pro");
    });
  });

  describe("convenience methods", () => {
    it("isValid returns true when state is ok", () => {
      const result = { state: "ok" } as ValidationResult;
      expect(isValid(result)).toBe(true);
    });

    it("isValid returns false when state is not ok", () => {
      const result = { state: "email_invalid" } as ValidationResult;
      expect(isValid(result)).toBe(false);
    });

    it("isInvalid returns true when state is email_invalid", () => {
      const result = { state: "email_invalid" } as ValidationResult;
      expect(isInvalid(result)).toBe(true);
    });

    it("isInvalid returns false when state is ok", () => {
      const result = { state: "ok" } as ValidationResult;
      expect(isInvalid(result)).toBe(false);
    });

    it("isDisposable returns true when subState is is_disposable", () => {
      const result = { subState: "is_disposable" } as ValidationResult;
      expect(isDisposable(result)).toBe(true);
    });

    it("isDisposable returns false when subState is email_ok", () => {
      const result = { subState: "email_ok" } as ValidationResult;
      expect(isDisposable(result)).toBe(false);
    });

    it("isRole returns true when subState is is_role", () => {
      const result = { subState: "is_role" } as ValidationResult;
      expect(isRole(result)).toBe(true);
    });

    it("isRole returns false when subState is email_ok", () => {
      const result = { subState: "email_ok" } as ValidationResult;
      expect(isRole(result)).toBe(false);
    });
  });

  describe("error handling", () => {
    it("throws AuthenticationError on 401", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({ error: "Unauthorized" }, { status: 401 })
      );

      const client = new Truelist(API_KEY, { maxRetries: 0 });

      await expect(client.email.validate("test@example.com")).rejects.toThrow(
        AuthenticationError
      );
    });

    it("does not retry 401 errors", async () => {
      fetchSpy.mockResolvedValue(
        createMockResponse({ error: "Unauthorized" }, { status: 401 })
      );

      const client = new Truelist(API_KEY, { maxRetries: 3 });

      await expect(client.email.validate("test@example.com")).rejects.toThrow(
        AuthenticationError
      );
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it("throws RateLimitError on 429 after retries exhausted", async () => {
      fetchSpy.mockResolvedValue(
        createMockResponse({ error: "Rate limited" }, { status: 429 })
      );

      const client = new Truelist(API_KEY, { maxRetries: 1 });

      await expect(client.email.validate("test@example.com")).rejects.toThrow(
        RateLimitError
      );
      // 1 initial + 1 retry = 2 calls
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("parses Retry-After header on 429", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { "Retry-After": "5" },
        })
      );

      const client = new Truelist(API_KEY, { maxRetries: 0 });

      try {
        await client.email.validate("test@example.com");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(5);
      }
    });

    it("throws ApiError on 400", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({ message: "Bad request" }, { status: 400 })
      );

      const client = new Truelist(API_KEY, { maxRetries: 0 });

      try {
        await client.email.validate("bad-email");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
        expect((error as ApiError).body).toEqual({ message: "Bad request" });
      }
    });

    it("does not retry 400 errors", async () => {
      fetchSpy.mockResolvedValue(
        createMockResponse({ message: "Bad request" }, { status: 400 })
      );

      const client = new Truelist(API_KEY, { maxRetries: 3 });

      await expect(client.email.validate("bad-email")).rejects.toThrow(ApiError);
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it("retries on 500 errors", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          createMockResponse({ error: "Internal server error" }, { status: 500 })
        )
        .mockResolvedValueOnce(createMockResponse(mockValidationResponse));

      const client = new Truelist(API_KEY, { maxRetries: 1 });
      const result = await client.email.validate("user@example.com");

      expect(result.state).toBe("ok");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("retries on 503 errors", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          createMockResponse({ error: "Service unavailable" }, { status: 503 })
        )
        .mockResolvedValueOnce(createMockResponse(mockValidationResponse));

      const client = new Truelist(API_KEY, { maxRetries: 1 });
      const result = await client.email.validate("user@example.com");

      expect(result.state).toBe("ok");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting retries on 500", async () => {
      fetchSpy.mockResolvedValue(
        createMockResponse({ error: "Server error" }, { status: 500 })
      );

      const client = new Truelist(API_KEY, { maxRetries: 2 });

      await expect(client.email.validate("test@example.com")).rejects.toThrow(
        TruelistError
      );
      // 1 initial + 2 retries = 3 calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("retries on network errors", async () => {
      fetchSpy
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(createMockResponse(mockValidationResponse));

      const client = new Truelist(API_KEY, { maxRetries: 1 });
      const result = await client.email.validate("user@example.com");

      expect(result.state).toBe("ok");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("does not retry when maxRetries is 0", async () => {
      fetchSpy.mockResolvedValue(
        createMockResponse({ error: "Server error" }, { status: 500 })
      );

      const client = new Truelist(API_KEY, { maxRetries: 0 });

      await expect(client.email.validate("test@example.com")).rejects.toThrow(ApiError);
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it("extracts error message from response body", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({ message: "Email format is invalid" }, { status: 422 })
      );

      const client = new Truelist(API_KEY, { maxRetries: 0 });

      try {
        await client.email.validate("bad");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe("Email format is invalid");
      }
    });
  });

  describe("cancellation", () => {
    it("supports AbortSignal for cancellation", async () => {
      // Mock fetch to respect the signal, like real fetch does
      fetchSpy.mockImplementation((_url: string | URL | Request, init?: RequestInit) => {
        return new Promise((resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(new DOMException("The operation was aborted.", "AbortError"));
            return;
          }
          const onAbort = () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          };
          signal?.addEventListener("abort", onAbort, { once: true });
          // Never resolve — simulates a long-running request
        });
      });

      const controller = new AbortController();
      const client = new Truelist(API_KEY, { maxRetries: 0 });

      const promise = client.email.validate("user@example.com", {
        signal: controller.signal,
      });

      controller.abort();

      await expect(promise).rejects.toThrow(TruelistError);
    });
  });

  describe("exports", () => {
    it("exports Truelist as default and named export", async () => {
      const mod = await import("../src/index");
      expect(mod.default).toBe(mod.Truelist);
    });

    it("exports error classes", async () => {
      const mod = await import("../src/index");
      expect(mod.TruelistError).toBeDefined();
      expect(mod.AuthenticationError).toBeDefined();
      expect(mod.RateLimitError).toBeDefined();
      expect(mod.ApiError).toBeDefined();
    });

    it("exports VERSION", async () => {
      const mod = await import("../src/index");
      expect(mod.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("exports convenience methods", async () => {
      const mod = await import("../src/index");
      expect(mod.isValid).toBeDefined();
      expect(mod.isInvalid).toBeDefined();
      expect(mod.isDisposable).toBeDefined();
      expect(mod.isRole).toBeDefined();
    });
  });

  describe("error class hierarchy", () => {
    it("AuthenticationError extends TruelistError", () => {
      const error = new AuthenticationError();
      expect(error).toBeInstanceOf(TruelistError);
      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(401);
    });

    it("RateLimitError extends TruelistError", () => {
      const error = new RateLimitError("rate limited", 30);
      expect(error).toBeInstanceOf(TruelistError);
      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(429);
      expect(error.retryAfter).toBe(30);
    });

    it("ApiError extends TruelistError", () => {
      const error = new ApiError("not found", 404, { message: "not found" });
      expect(error).toBeInstanceOf(TruelistError);
      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(404);
      expect(error.body).toEqual({ message: "not found" });
    });
  });
});
