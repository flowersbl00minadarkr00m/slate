# Contributing to Slate

Thanks for your interest. Slate is a small, opinionated project — a YouTube front end built around the idea that a feed should end. Contributions that sharpen that idea are welcome; contributions that turn it back into an infinite feed are not.

## Getting started

```bash
npm install
npm run dev        # front end only
vercel dev         # front end + the serverless scoring functions in api/
```

Open `http://localhost:5173/?demo=1` for the seeded demo (no API keys needed). For the full app, copy `.env.example` to `.env.local` and add your own server-side keys.

## Ground rules

- **No secrets in the client.** YouTube, OpenAI, and Supabase calls live in `api/` serverless functions only. A PR that puts a key in browser code will be declined.
- **The demo route stays stateless.** `?demo=1` must make zero external requests and never touch localStorage.
- **The feed must end.** The slate cap, per-goal budgets, and edition lock are the product. Features that add infinite content paths are out of scope.
- **Keep the brand.** Fraunces display type, paper/ink/chartreuse palette, brutalist cards. Refine it, don't replace it.

## Where work is planned

Development follows a lightweight spec-driven flow in `.ai/sdd/specs/001-v2-open-source-release/` — `requirements.md` (what and why), `design.md` (how), `tasks.md` (the plan, with completed tasks carrying verification evidence). Pick an unchecked task whose dependencies are complete, or open an issue to propose something new.

## Verifying changes

There is no test suite yet (it arrives with task T9). Until then:

1. `npm run build` must pass.
2. Load `?demo=1` — seeded feed renders, no network requests in devtools.
3. Load the normal route — edit a goal, reload, confirm it persisted.

## License

MIT. By contributing you agree your contributions are licensed under the same terms.
