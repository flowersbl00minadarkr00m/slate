# Slate

A YouTube front end that shows you a finite, goal-aligned set of videos each day — and then ends.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![Slate](slate/docs/hero.png)

Most feeds are built to never finish. Slate is built around the opposite idea — the **broadcast day**: a newspaper or an evening bulletin arrived at a set time, it was finite, and when you got through it, you were done. You tell Slate what you're trying to learn or follow, and twice a day it programs a short slate of videos that fit. When you've watched or cleared them, there is nothing left to scroll.

## How it works

- **Goals with a time budget** — each goal has a plain-language description and a weekly minute allowance; the description is what the relevance scorer reads
- **A blended candidate pool** — goal-driven searches plus uploads from channels you add, scored for fit with a light popularity signal
- **A feed that ends** — a hard cap per slate, a daily slice per goal, editions that unlock only at set times, and a sign-off screen instead of infinite scroll
- **Visible relevance** — each card shows which goal it matched and a one-line reason

## Run it

The app lives in [`slate/`](slate/) — see its [README](slate/README.md) for the full walkthrough.

```bash
cd slate
npm install
vercel dev     # runs the front end plus the serverless slate builder
```

The slate builder runs server-side (`slate/api/build-slate.js`) so YouTube, OpenAI, and Supabase keys never reach the browser.

## License

[MIT](LICENSE)
