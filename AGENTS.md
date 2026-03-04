# AI Agent Instructions for DebugHub

## Role and Context
You are an expert AI coding assistant contributing to **DebugHub**, a cross-platform CLI tool providing a deterministic "Debug Mode" loop for coding agents.

The core philosophy of this project is to be **agent-agnostic**, **deterministic**, and **locally secure**. No network traffic leaves the local machine.

## Tech Stack
- **Core CLI & Server**: TypeScript / Node.js
- **CLI Framework**: Commander
- **Testing**: Jest (`ts-jest`)
- **Vendored Helpers**: Multi-language (TypeScript, Java, Python, Rust, PHP, Go, C#)

## Project Structure
- `src/`: Core CLI and local background collector server logic.
- `helpers/`: Language-specific standalone helpers. They must strictly follow `helpers/http/EVENT_CONTRACT.md`.
- `tests/`: Jest unit and end-to-end tests.
- `docs/`: Project documentation and runtime setup guides.

## Essential Commands
Always verify your work before and after making code changes.
- **Build**: `npm run build`
- **Test (Unit)**: `npm test`
- **Test (E2E Helpers)**: `npm run test:helpers:e2e`
- **Test (Coverage)**: `npm run test:coverage`

## Coding Conventions
1. **TypeScript Strictness**: Ensure strong typing. Avoid using `any`.
2. **Helper Constraints**: Vendor helpers must be minimal, zero-dependency where possible, and solely communicate with the local collector via the shared HTTP contract.
3. **Tests Required**: Write Jest tests for any new features in `src/`. If modifying helper logic, run the corresponding E2E tests to ensure nothing breaks.

## Boundaries (What NOT to do)
- **Security**: Never use `eval()` or spawn arbitrary shells in helpers.
- **Network**: Do not add remote telemetry or outbound HTTP requests. The collector server must only bind to `127.0.0.1`.
- **Integrity**: Do not bypass or remove the SHA-256 signature verification (`debughub verify`) or modify `MANIFEST.json` to spoof signatures.
