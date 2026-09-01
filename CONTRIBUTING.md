# Contributing to Slate

Thanks for your interest. Slate is a small, opinionated project — a YouTube
front end built around the idea that a feed should end. Contributions that
sharpen that idea are welcome; contributions that turn it back into an infinite
feed are not.

## Getting started

Run these commands from the flat repository root:

```bash
npm ci
npm run dev        # frontend only
vercel dev         # root frontend plus the serverless builder in api/
```

Open `http://localhost:5173/?demo=1` for the seeded demo (no API keys needed).
For the full app, copy `.env.example` to `.env.local` and add your own
server-only keys. Keep `SLATE_API_ENABLED=0` until the provider configuration
is ready for intentional generation.

## Ground rules

- **No secrets in the client.** YouTube, OpenAI, and Supabase calls live in
  `api/` serverless functions only. A change that puts a key in browser code
  will be declined.
- **The demo route stays stateless.** `?demo=1` must make zero cross-origin
  requests and never touch localStorage or sessionStorage.
- **The feed must end.** The slate cap, per-goal budgets, and edition lock are
  the product. Features that add infinite content paths are out of scope.
- **Keep the brand.** Georgia/system display fallbacks, the paper/ink/chartreuse
  palette, and brutalist cards are the current root product language. Refine it,
  don't replace it.
- **Keep the root canonical.** Do not merge or copy unrelated repository
  history into this application.

## Where work is planned

Development follows a lightweight spec-driven flow in `.ai/sdd/specs/` —
`requirements.md` (what and why), `design.md` (how), and `tasks.md` (the plan,
with completed tasks carrying verification evidence). Pick an unchecked task
whose dependencies are complete, or propose something new through the private
maintainer channel until canonical publication exists.

## Verifying changes

The root test and release checks are available now:

1. `npm ci` must pass.
2. `npm run lint` must pass.
3. `npm test -- --run` must pass.
4. `npm run build` must pass.
5. `npm audit --omit=dev --audit-level=high` must pass.
6. Load `?demo=1` — the seeded feed renders with no cross-origin or storage
   requests.
7. Load the normal route — edit a goal, reload, and confirm it persisted.

For source and deployment release controls, review
[docs/release-checklist.md](docs/release-checklist.md). Deployed health,
security-header, and WAF evidence is a separate T5 operation.

## License

MIT. By contributing you agree your contributions are licensed under the same
terms.
