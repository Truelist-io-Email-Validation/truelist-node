# truelist

Official Node.js SDK for the [Truelist.io](https://truelist.io) email validation API.

[![npm version](https://img.shields.io/npm/v/truelist.svg)](https://www.npmjs.com/package/truelist)
[![CI](https://github.com/truelist/truelist-node/actions/workflows/ci.yml/badge.svg)](https://github.com/truelist/truelist-node/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

```bash
npm install truelist
```

## Quick Start

```ts
import Truelist from "truelist";

const truelist = new Truelist("your-api-key");
const result = await truelist.email.validate("user@example.com");
console.log(result.state); // "valid"
```

## Usage

### Validate an Email

Use `email.validate()` for server-side email validation (10 req/s rate limit):

```ts
const result = await truelist.email.validate("user@example.com");

console.log(result.state);     // "valid" | "invalid" | "risky" | "unknown"
console.log(result.subState);  // "ok" | "disposable_address" | ...
console.log(result.freeEmail); // true
console.log(result.role);      // false
console.log(result.disposable); // false
console.log(result.suggestion); // null or suggested correction
```

### Form-Level Validation

Use `email.formValidate()` for frontend form validation (60 req/min rate limit):

```ts
const result = await truelist.email.formValidate("user@example.com");
```

The response shape is identical to `email.validate()`.

### Check Account Info

```ts
const account = await truelist.account.get();
console.log(account.email);   // "you@company.com"
console.log(account.plan);    // "pro"
console.log(account.credits); // 9500
```

### Cancel a Request

Pass an `AbortSignal` to cancel in-flight requests:

```ts
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

const result = await truelist.email.validate("user@example.com", {
  signal: controller.signal,
});
```

## Configuration

```ts
const truelist = new Truelist("your-api-key", {
  baseUrl: "https://api.truelist.io", // API base URL (default)
  timeout: 30000,                      // Request timeout in ms (default: 30000)
  maxRetries: 2,                       // Max retries on failure (default: 2)
});
```

## Retries and Rate Limiting

The SDK automatically retries failed requests with exponential backoff:

- **Retried status codes**: 429 (rate limit), 500, 502, 503, 504
- **Retried errors**: Network failures, timeouts
- **Backoff**: 500ms, 1000ms, 2000ms (with jitter)
- **Retry-After**: The SDK respects the `Retry-After` header on 429 responses

Set `maxRetries: 0` to disable retries entirely.

## Error Handling

All errors extend `TruelistError`:

```ts
import Truelist, { AuthenticationError, RateLimitError, ApiError, TruelistError } from "truelist";

try {
  const result = await truelist.email.validate("user@example.com");
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Invalid API key (401)
    console.error("Bad API key");
  } else if (error instanceof RateLimitError) {
    // Rate limited (429) — retries exhausted
    console.error("Rate limited, retry after:", error.retryAfter);
  } else if (error instanceof ApiError) {
    // Other API error (4xx/5xx)
    console.error("API error:", error.status, error.body);
  } else if (error instanceof TruelistError) {
    // Timeout, network error, or cancelled request
    console.error("Request failed:", error.message);
  }
}
```

### Error Classes

| Class | Status | Description |
|-------|--------|-------------|
| `AuthenticationError` | 401 | Invalid or missing API key |
| `RateLimitError` | 429 | Rate limit exceeded (includes `retryAfter` if available) |
| `ApiError` | varies | Any other HTTP error (includes `status` and `body`) |
| `TruelistError` | - | Base class: timeout, network, or cancellation errors |

## TypeScript Types

All types are exported for direct use:

```ts
import type {
  ValidationResult,
  ValidationState,
  ValidationSubState,
  AccountInfo,
  TruelistOptions,
  ValidateOptions,
} from "truelist";
```

### ValidationState

`"valid"` | `"invalid"` | `"risky"` | `"unknown"`

### ValidationSubState

`"ok"` | `"accept_all"` | `"disposable_address"` | `"role_address"` | `"failed_mx_check"` | `"failed_spam_trap"` | `"failed_no_mailbox"` | `"failed_greylisted"` | `"failed_syntax_check"` | `"unknown"`

## Edge Runtime Support

This SDK uses the standard `fetch` API with no Node.js-specific dependencies. It works in:

- **Node.js** 18+
- **Vercel Edge Functions**
- **Cloudflare Workers**
- **Deno**

```ts
// Cloudflare Worker example
export default {
  async fetch(request: Request): Promise<Response> {
    const truelist = new Truelist(env.TRUELIST_API_KEY);
    const result = await truelist.email.validate("user@example.com");
    return Response.json(result);
  },
};
```

## API Reference

### `new Truelist(apiKey, options?)`

Create a new Truelist client.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiKey` | `string` | Yes | Your Truelist API key |
| `options.baseUrl` | `string` | No | API base URL. Default: `https://api.truelist.io` |
| `options.timeout` | `number` | No | Request timeout in ms. Default: `30000` |
| `options.maxRetries` | `number` | No | Max retry attempts. Default: `2` |

### `truelist.email.validate(email, options?)`

Validate an email address (server-side). Rate limit: 10 req/s.

Returns `Promise<ValidationResult>`.

### `truelist.email.formValidate(email, options?)`

Validate an email address (form-level, frontend use). Rate limit: 60 req/min.

Returns `Promise<ValidationResult>`.

### `truelist.account.get()`

Get account information including remaining credits.

Returns `Promise<AccountInfo>`.

## License

MIT
