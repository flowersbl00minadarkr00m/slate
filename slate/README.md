# Slate

A YouTube front end that shows you a finite, goal-aligned set of videos each day, and then ends.

Most feeds are built to never finish. Slate is built around the opposite idea, which I think of as the **broadcast day**: a newspaper or an evening news bulletin arrived at a set time, it was finite, you got through it, and then you were done. Slate brings that shape back. You tell it what you are trying to learn or follow for a period of time, and twice a day it programs a short slate of videos that fit those goals. When you have watched or cleared them, there is nothing left to scroll.

## What it does

I built this around three ideas that work together.

**Goals, with a time budget.** You define a small set of goals, each with a plain-language description and a weekly minute allowance. The description is what the relevance scorer reads, so "practitioner depth on AI governance, not hype" produces a very different slate than "anything about AI." Goals can carry an end date and retire themselves when the period is over.

**A blended candidate pool, ranked for fit with a light popularity signal.** Slate pulls candidates two ways: goal-driven searches as the primary source, and uploads from any channels you add as a secondary source. Once a video is in the pool, where it came from stops mattering. Everything is scored against your goals, then blended with a modest popularity/freshness signal so the slate favours material that is both intellectually useful and less obscure.

**A feed that ends.** Three mechanics enforce this. There is a hard cap on how many videos make the slate. Each goal gets a daily slice of its weekly budget, and the slate fills that slice and stops. And new editions only unlock at the times you set (the default is a morning and an evening edition), so there is no pull-to-refresh loop in between. When the slate is empty, you get a sign-off screen instead of more content.

The relevance scoring is the part that makes this more than a keyword filter. "FIBA tactical breakdown" and "wild NBA trade rumor" both mention basketball, but only one of them matches a goal about film study. A short call to OpenAI reads the title, channel, and description, picks the best-matching goal, and returns a score with a one-line reason you can see on each card.

## How it is built

The front end is React and Vite. The browser only sends goals, channels, and programming rules.

The slate builder runs server-side, in `api/build-slate.js`. This matters for two reasons. A browser should not hold private OpenAI, YouTube, or Supabase keys, and putting them in client code would expose them to anyone who opens the page. So the browser sends the goal configuration to that function, the function pulls YouTube candidates, reuses Supabase cache where possible, scores missing candidates with OpenAI, and returns the finished slate.

Supabase is something I personally used as a backend cache and lightweight run log. It can store video metadata, scored goal/video matches, and generated slate runs so later requests can avoid re-fetching and re-scoring known videos.

To apply the cache schema manually, set `POSTGRES_URL_NON_POOLING` or `POSTGRES_URL` in `.env.local`, then run:

```bash
npm run db:apply
```

## Running it locally

You will need Node 18 or newer.

```bash
npm install
```

Create a `.env.local` file from the example and add your server-side keys:

```bash
cp .env.example .env.local
# then edit .env.local and paste your keys
```

The serverless builder lives under `api/`, which plain Vite does not run on its own. The simplest way to run both the app and the function locally is the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

If you only want to work on the interface and are not testing scoring, `npm run dev` runs the front end by itself.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repo. It will detect Vite and use the right build settings on its own.
3. Under Settings, Environment Variables, add `OPENAI_API_KEY` and `YOUTUBE_API_KEY`. Optionally add `SLATE_MODEL` to override the default. If using Supabase caching, also add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the Vercel/Supabase Postgres connection string.
4. Deploy.

That gives you a live URL you can share. Because editions only unlock at set times, the refresh lock becomes genuinely binding once the app is deployed and running across sessions.

## A few honest notes

This is a prototype, and it behaves like one in a couple of places.

Settings do not persist yet. Goals, channels, and rules reset on reload. Supabase currently caches shared video/scoring/run data, not user accounts or personal settings.

The normal app does not have accounts, but it still processes data: goal text and video metadata pass through the serverless builder to YouTube, OpenAI, and Supabase. The seeded demo route avoids that processing entirely.

The YouTube Data API gives you 10,000 quota units a day, and search calls cost 100 each. Slate is deliberately frugal here, two queries per goal plus cheap channel pulls, which keeps a normal day well under the limit. The usage estimate in the corner of the feed helps you keep an eye on it.

The scorer defaults to `gpt-5.5` with reasoning disabled because the task is short and structured. Use `SLATE_MODEL` to test another compatible model against representative results before changing the default.

## Why I made it

I wanted to see whether the thing that makes a feed addictive, its endlessness, could be replaced with the thing that makes a newspaper satisfying, its ending. Slate is my attempt at that. The constraint that started as a technical limit, a finite API budget, turned out to be the whole point.
