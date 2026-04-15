# Browser Setup

Use the browser helper when you need DebugHub events from code running in the page. Start the collector first with `debughub start`, then wire one of the bootstrap patterns below before probes fire.

## Plain `<script>` tag

```html
<script>
window.__DEBUGHUB__ = {
  enabled: true,
  session: "SESSION_ID",
  endpoint: "http://127.0.0.1:PORT"
};
</script>
<script type="module">
import { debugProbe } from './.debughub/vendor/current/ts/debugProbe.browser.js';
debugProbe('page-loaded');
</script>
```

## Webpack

```ts
import { initDebugHub } from './.debughub/vendor/current/ts/debugProbe.browser';

initDebugHub({
  enabled: true,
  session: 'SESSION_ID',
  endpoint: 'http://127.0.0.1:PORT'
});
```

```ts
new webpack.DefinePlugin({
  'process.env.DEBUGHUB_ENABLED': JSON.stringify('1'),
  'process.env.DEBUGHUB_SESSION': JSON.stringify('SESSION_ID'),
  'process.env.DEBUGHUB_ENDPOINT': JSON.stringify('http://127.0.0.1:PORT')
});
```

## Vite

```ts
import { initDebugHub } from './.debughub/vendor/current/ts/debugProbe.browser';

initDebugHub({
  enabled: true,
  session: 'SESSION_ID',
  endpoint: 'http://127.0.0.1:PORT'
});
```

## Next.js

```ts
import { initDebugHub } from '../.debughub/vendor/current/ts/debugProbe.browser';

initDebugHub({
  enabled: true,
  session: 'SESSION_ID',
  endpoint: 'http://127.0.0.1:PORT'
});
```

Call it in `_app.tsx`, `app/layout.tsx`, or another client entry point that runs before your instrumented code.

## React (any bundler)

```ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initDebugHub } from './.debughub/vendor/current/ts/debugProbe.browser';

initDebugHub({ enabled: true, session: 'SESSION_ID', endpoint: 'http://127.0.0.1:PORT' });
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```
