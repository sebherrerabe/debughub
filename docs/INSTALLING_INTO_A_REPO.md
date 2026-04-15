# Installing DebugHub into a Target Repository

As an agent, you can equip any existing repository using TypeScript/Node, Browser TS/JS, Java, Python, Rust, PHP, Go, or C# with DebugHub to enable a powerful, agentic debug loop.

## 1. Prerequisites
Ensure you can run `npx` (or `npm execute`) or run `node` locally. 
The repository you inject DebugHub into does not need any new package dependencies in `package.json`.

## 2. Installation Step
Run the `debughub install` command at the root of the target repository.
Ideally, run:
```bash
npx debughub install
```
*(If `npx` is unavailable, specify the path to CLI index)*

### What it does:
- Copies standalone runtime helpers for all supported languages (TypeScript, Java, Python, Rust, PHP, Go, C#) into `.debughub/vendor/<version>/`.
- Creates a `MANIFEST.json`.
- Runs `verify` to confirm that the files are intact.

## 3. Starting the Collector
Run:
```bash
npx debughub start
```
This spawns a local, background HTTP server bound to `127.0.0.1`.
The command will output the `sessionId`, `endpoint`, and the output file path (e.g., `.debughub/out/<sessionId>.jsonl`).

## 4. Using the Helpers
Import the vendored files in the files you are altering for debugging. The examples below show Node.js and Java, but corresponding helpers exist for all supported languages in `.debughub/vendor/current/`:
- **Node.js**:
  ```ts
  import { debugProbe } from '../../.debughub/vendor/current/ts/debugProbe';
  debugProbe('Reached user fetch', { userId }, { hypothesisId: 'H1', level: 'info' });
  ```

- **Java**:
  Prefer the inline HTTP path for temporary debugging:
  1. Run `debughub inject java --mode inline-http --target <path-to-class>`.
  2. Paste the generated imports and `debugHubEmit(...)` members into that class.
  3. Add the generated `debugHubEmit(...)` call where you want the event.
  4. Start DebugHub and attach `.debughub/runtime.env` in IntelliJ EnvFile.
  5. Restart the run configuration after wiring the env file and after any later `debughub start`.
  6. Verify with `debughub doctor --java`.

  For full Java-specific guidance, see [JAVA_SETUP.md](./JAVA_SETUP.md).

For browser-specific bootstrap patterns, see [BROWSER_SETUP.md](./BROWSER_SETUP.md).

## 5. View Events
Execute the task and run:
```bash
npx debughub tail --n 100
```
Or search for specific hypotheses:
```bash
npx debughub search --hypothesis H1
```
