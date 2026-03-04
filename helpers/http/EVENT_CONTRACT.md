# DebugHub HTTP Event Contract

This contract defines the minimum behavior all runtime helpers must follow.

## Environment Variables

- `DEBUGHUB_ENABLED`: must be exactly `1` to emit events.
- `DEBUGHUB_SESSION`: required non-empty session id.
- `DEBUGHUB_ENDPOINT`: required base endpoint (for example `http://127.0.0.1:7777`).

If any required value is missing or invalid, helpers must no-op.

## Transport

- Method: `POST`
- URL: `{DEBUGHUB_ENDPOINT}/event` (append `/event` after trimming any trailing slash)
- Content-Type: `application/json`
- Delivery mode: best-effort, fire-and-forget behavior from the application perspective
- Failure handling: helper must never throw into host application code

## Payload Schema

Required keys:

- `ts`: string
- `sessionId`: string
- `label`: string
- `data`: any JSON value or `null`
- `hypothesisId`: string or `null`
- `loc`: string or `null`
- `level`: one of `info`, `warn`, `error`
- `tags`: object or `null`
- `runtime`: string

Defaults:

- `data`: `null`
- `hypothesisId`: `null`
- `loc`: `null`
- `level`: `info`
- `tags`: `null`

## Runtime Field Values

Helpers should use a stable runtime name:

- `node`
- `browser`
- `java`
- `python`
- `rust`
- `php`
- `go`
- `csharp`
