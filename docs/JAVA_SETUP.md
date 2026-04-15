# Java Setup

Use the inline HTTP path for temporary Java debugging. It avoids package-placement churn and works better in IDE-driven workflows than creating a separate helper class first.

## Preferred flow

1. Install DebugHub in the repo:

```bash
npx debughub install
```

2. Start the collector:

```bash
npx debughub start
```

This writes `.debughub/runtime.env` with the current `DEBUGHUB_ENABLED`, `DEBUGHUB_SESSION`, and `DEBUGHUB_ENDPOINT` values.

3. Generate the inline Java snippet for the class you are instrumenting:

```bash
debughub inject java --mode inline-http --target path/to/MyService.java
```

4. Paste the generated imports and `debugHubEmit(...)` members into that class.

5. Add a call site where you want the event:

```java
debugHubEmit("debughub_probe", Map.of("step", "before-query"), Map.of("hypothesisId", "H1", "level", "info"));
```

6. Verify wiring before reproducing:

```bash
debughub doctor --java
```

7. Reproduce the issue and inspect events:

```bash
debughub tail --n 100
debughub search --label debughub_probe
```

## Helper-class mode

Only use `helper-class` when you want to reuse the emitter across multiple classes:

```bash
debughub inject java --mode helper-class --target path/to/MyService.java
```

The generated helper should live in the same package and module as the code under test. Do not create a top-level `debughub.*` package unless your repo already uses that pattern.

## IntelliJ + EnvFile

1. Run `npx debughub start`.
2. Open the IntelliJ run configuration for the backend module you will launch.
3. Enable EnvFile and attach `<repo>/.debughub/runtime.env`.
4. Restart the run configuration after attaching the file.
5. Restart the run configuration again after every later `debughub start`, because the session id and endpoint may change.
6. Run `debughub doctor --java` if events do not appear.

## Windows checklist

- Run `npx debughub install`.
- Run `npx debughub start`.
- Point IntelliJ EnvFile at `<repo>\\.debughub\\runtime.env`.
- Restart the run configuration after every `debughub start`.
- Use `debughub inject java --mode inline-http --target <path-to-class>`.
- Paste the generated code, reproduce, then inspect with `debughub tail` or `debughub search`.
