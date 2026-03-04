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
  Include `DebugProbe.java` into the build or directly into the package structure being compiled, and call:
  ```java
  DebugProbe.probe("Executing query", sqlArgs, Map.of("hypothesisId", "H2", "level", "warn"));
  ```

## 5. View Events
Execute the task and run:
```bash
npx debughub tail --n 100
```
Or search for specific hypotheses:
```bash
npx debughub search --hypothesis H1
```
