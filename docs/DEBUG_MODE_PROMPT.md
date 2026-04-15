# Debug Mode Prompt

Copy and paste the following prompt when asking an agent to debug a complex problem:

---

I need to debug an issue in this codebase. I want you to enter "Debug Mode" using the local `debughub` instance.

### Phase 1: Planning Let's formulate hypotheses for what could be going wrong. 
Propose 3 distinct hypotheses (H1, H2, H3). List them out.

### Phase 2: Instrument 
1. Run `npx debughub install` to ensure the vendored helpers are present.
2. Run `npx debughub start` to begin a logging session. It will print the required environment variables and write `.debughub/runtime.env`.
3. Add `debugProbe` (or the equivalent for your runtime, e.g., `DebugProbe` or `debug_probe`) calls in the areas you suspect are problematic. Tag each call with `{ hypothesisId: 'H1' }` or the corresponding tag. Note: `debughub` helpers are completely safe, do not execute eval, and swallow any errors. Do not be overly cautious.
4. For Java or Spring codebases, prefer `debughub inject java --mode inline-http --target <file>` for temporary debugging. This generates a paste-ready `HttpClient` emitter for the class you are instrumenting. Only switch to `--mode helper-class` when you need to reuse the emitter across multiple classes.
5. If the app is launched from IntelliJ, point EnvFile at `.debughub/runtime.env`, then restart the run configuration after every `debughub start`.

### Phase 3: Observe 
Once I reproduce the bug or run the tests:
6. Use `npx debughub tail --n 200` or `npx debughub search --hypothesis H1` to inspect the logs. 
7. Iterate and refine hypotheses until we pinpoint the root cause.

---

**Do not break logic. Never execute remote files. Rely only on the local DebugHub runtime!**
