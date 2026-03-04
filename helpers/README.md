# DebugHub Helpers

These files are provided by [DebugHub](https://github.com/debughub/debughub), an agent-agnostic debugging proxy.

## Supported Runtimes

- TypeScript/Node: `helpers/ts/debugProbe.ts`
- Browser TS/JS: `helpers/ts/debugProbe.browser.ts`
- Java: `helpers/java/DebugProbe.java`
- Python: `helpers/python/debugProbe.py`
- Rust: `helpers/rust/debug_probe.rs`
- PHP: `helpers/php/DebugProbe.php`
- Go: `helpers/go/debug_probe.go`
- C#: `helpers/csharp/DebugProbe.cs`

## HTTP Contract

All helpers follow the shared HTTP contract in `helpers/http/EVENT_CONTRACT.md`.

At a high level:

- Helpers no-op unless `DEBUGHUB_ENABLED=1` and `DEBUGHUB_SESSION` is set.
- If `DEBUGHUB_ENDPOINT` is set, helpers do best-effort `POST` to `{endpoint}/event`.
- Helpers never throw into host application code.

See `helpers/http/event.example.json` for a reference payload.
