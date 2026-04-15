# DebugHub

A cross-platform CLI tool providing a Cursor-like "Debug Mode" loop for any coding agent (Codex, Claude, etc.), without requiring MCP or complex remote execution setups.

## Features
- **Runtime Setup Guide**: See `docs/RUNTIME_PREREQS.md` for installing Java/Go/Python/Rust/PHP/.NET required by helper E2E tests.
- **Agent-Agnostic**: Works with any coding assistant capable of modifying files and running basic OS commands.
- **Vendored Runtime Helpers**: Small, standalone helpers for TypeScript/Node, Browser TS/JS, Java, Python, Rust, PHP, Go, and C# are installed in `.debughub/vendor`.
- **Java Inline Injection**: `debughub inject java --mode inline-http` prints a paste-ready `HttpClient` emitter for the class you are instrumenting.
- **Shared HTTP Contract**: All helpers follow one event contract (`.debughub/vendor/<version>/http/EVENT_CONTRACT.md` after `debughub install`) and submit best-effort HTTP events to the local collector.
- **Deterministic**: A `MANIFEST.json` and strict integrity verification ensures files are not tampered with.
- **Safe and Local**: By default, the collector server only binds to `127.0.0.1`.

## Quick Start

1. Install inside any repository:
```bash
npx debughub install
```
2. Start the local collector:
```bash
npx debughub start
```
3. Read the given `sessionId` and endpoint. Follow the instructions to configure your environment variables:
   - `DEBUGHUB_ENABLED=1`
   - `DEBUGHUB_SESSION=<sessionId>`
   - `DEBUGHUB_ENDPOINT=http://127.0.0.1:<port>`
   - or attach `.debughub/runtime.env` from your IDE run configuration
4. For Java, prefer:
```bash
debughub inject java --mode inline-http --target path/to/MyService.java
```
5. Use the generated snippet or the vendored helper inside your app code (see `.debughub/vendor/<version>`).
6. Run your app and reproduce the issue.
7. Check logs:
```bash
npx debughub tail --n 50
```

See `docs/JAVA_SETUP.md` for the IntelliJ + EnvFile workflow.

## Security Model
- No network traffic leaves your local machine.
- No remote code is downloaded at runtime.
- No `eval` or shell spawning in helpers.
- The `debughub verify` command validates the helper code matches the official SHA-256 signatures.

## Commands
- `debughub install`: Installs support files to `.debughub/`.
- `debughub start`: Starts the collector server in the background.
- `debughub stop`: Stops the background collector.
- `debughub tail`: Print the latest recorded events.
- `debughub search "<query>"`: Search events by text or label.
- `debughub clear`: Clears the output log file.
- `debughub verify`: Verifies integrity of the vendor code in `.debughub/`.
- `debughub doctor`: Checks installation and system status.
- `debughub inject java`: Prints repo-aware Java instrumentation guidance without editing files.
