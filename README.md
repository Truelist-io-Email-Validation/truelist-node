# truelist

Official Node.js SDK for the [Truelist.io](https://truelist.io) email validation API.

[![npm version](https://img.shields.io/npm/v/truelist.svg)](https://www.npmjs.com/package/truelist)
[![CI](https://github.com/Truelist-io-Email-Validation/truelist-node/actions/workflows/ci.yml/badge.svg)](https://github.com/Truelist-io-Email-Validation/truelist-node/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

```bash
npm install truelist
```

## Quick Start

```ts
import Truelist from "truelist";

const truelist = new Truelist("your-api-key");
const result = await truelist.email.validate("user@example.com");
console.log(result.state); // "ok"
```

## Usage

### Validate an Email

```ts
import { isValid, isDisposable, isRole } from "truelist";

const result = await truelist.email.validate("user@example.com");

console.log(result.email);      // "user@example.com"
console.log(result.domain);     // "example.com"
console.log(result.state);      // "ok" | "email_invalid" | "risky" | "unknown" | "accept_all"
console.log(result.subState);   // "email_ok" | "is_disposable" | ...
console.log(result.suggestion); // null or suggested correction
console.log(result.verifiedAt); // "2026-02-21T10:00:00.000Z"

// Convenience methods
console.log(isValid(result));      // true
console.log(isDisposable(result)); // false
console.log(isRole(result));       // false
```

### Check Account Info

```ts
const account = await truelist.account.get();
console.log(account.email);               // "you@company.com"
console.log(account.name);                // "Your Name"
console.log(account.uuid);                // "a3828d19-..."
console.log(account.timeZone);            // "America/New_York"
console.log(account.isAdminRole);         // true
console.log(account.account.paymentPlan); // "pro"
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

`"ok"` | `"email_invalid"` | `"risky"` | `"unknown"` | `"accept_all"`

### ValidationSubState

`"email_ok"` | `"accept_all"` | `"is_disposable"` | `"is_role"` | `"failed_smtp_check"` | `"failed_mx_check"` | `"failed_spam_trap"` | `"failed_no_mailbox"` | `"failed_greylisted"` | `"failed_syntax_check"` | `"unknown_error"`

### ValidationResult

| Property | Type | Description |
|----------|------|-------------|
| `email` | `string` | The email address validated |
| `domain` | `string` | Domain part of the email |
| `canonical` | `string` | Canonical (local) part of the email |
| `mxRecord` | `string \| null` | MX record for the domain |
| `firstName` | `string \| null` | First name (if detected) |
| `lastName` | `string \| null` | Last name (if detected) |
| `state` | `ValidationState` | Overall validation state |
| `subState` | `ValidationSubState` | Detailed sub-state |
| `verifiedAt` | `string` | ISO timestamp of verification |
| `suggestion` | `string \| null` | Did-you-mean suggestion |

### Convenience Methods

| Function | Description |
|----------|-------------|
| `isValid(result)` | `true` if `state === "ok"` |
| `isInvalid(result)` | `true` if `state === "email_invalid"` |
| `isDisposable(result)` | `true` if `subState === "is_disposable"` |
| `isRole(result)` | `true` if `subState === "is_role"` |

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

Validate an email address.

Returns `Promise<ValidationResult>`.

### `truelist.account.get()`

Get account information.

Returns `Promise<AccountInfo>`.

## License

MIT
