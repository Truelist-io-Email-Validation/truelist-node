# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-20

### Added

- Initial release of the Truelist Node.js SDK
- `email.validate()` for server-side email validation
- `email.formValidate()` for form-level email validation
- `account.get()` for retrieving account information
- Automatic retries with exponential backoff on 429 and 5xx errors
- Retry-After header support for rate limit handling
- AbortSignal support for request cancellation
- Custom error classes: `TruelistError`, `AuthenticationError`, `RateLimitError`, `ApiError`
- ESM and CJS dual-format output
- Full TypeScript type definitions
- Edge runtime compatibility (Vercel Edge, Cloudflare Workers, Deno)
