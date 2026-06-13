# Slate

A YouTube front end that shows you a finite, goal-aligned set of videos each day, and then ends.

Most feeds are built to never finish. Slate is built around the opposite idea, which I think of as the **broadcast day**: a newspaper or an evening news bulletin arrived at a set time, it was finite, you got through it, and then you were done. Slate brings that shape back. You tell it what you are trying to learn or follow for a period of time, and twice a day it programs a short slate of videos that fit those goals. When you have watched or cleared them, there is nothing left to scroll.

## What it does

I built this around three ideas that work together.

**Goals, with a time budget.** You define a small set of goals, each with a plain-language description and a weekly minute allowance. The description is what the relevance scorer reads, so "practitioner depth on AI governance, not hype" produces a very different slate than "anything about AI." Goals can carry an end date and retire themselves when the period is over.

**A blended candidate pool, ranked on relevance alone.** Slate pulls candidates two ways: goal-driven searches as the primary source, and uploads from any channels you add as a secondary source. Once a video is in the pool, where it came from stops mattering. Everything is scored against your goals and ranked on that score, so a channel you follow gets no home-team advantage over a video the search surfaced.

**A feed that ends.** Three mechanics enforce this. There is a hard cap on how many videos make the slate. Each goal gets a daily slice of its weekly budget, and the slate fills that slice and stops. And new editions only unlock at the times you set (the default is a morning and an evening edition), so there is no pull-to-refresh loop in between. When the slate is empty, you get a sign-off screen instead of more content.

The relevance scoring is the part that makes this more than a keyword filter. "FIBA tactical breakdown" and "wild NBA trade rumor" both mention basketball, but only one of them matches a goal about film study. A short call to Claude reads the title, channel, and description, picks the best-matching goal, and returns a score with a one-line reason you can see on each card.

## How it is built

The front end is React and Vite. Filtering for minimum length and removing Shorts happens client-side, since duration comes straight from the YouTube Data API.

The scoring call to Claude runs server-side, in `api/score.js`. This matters for two reasons. A browser cannot call the Anthropic API directly, and even if it could, putting an API key in client code would expose it to anyone who opens the page. So the browser sends the video metadata to that function, the function holds the key and talks to Claude, and only the scores come back. If you deploy on Vercel, that file becomes a serverless function with no extra setup.

The YouTube key works differently. Each person enters their own in the interface, and it stays in their session. That keeps your YouTube quota yours, though it does mean anyone you share a live link with needs their own key. If you would rather remove that friction for a demo, you can move the YouTube calls server-side the same way the scoring call works, and cover the quota yourself.

## Running it locally

You will need Node 18 or newer.

```bash
npm install
```

Create a `.env` file from the example and add your Anthropic key:

```bash
cp .env.example .env
# then edit .env and paste your key
```

The scoring function lives under `api/`, which plain Vite does not run on its own. The simplest way to run both the app and the function locally is the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

If you only want to work on the interface and are not testing scoring, `npm run dev` runs the front end by itself.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repo. It will detect Vite and use the right build settings on its own.
3. Under Settings, Environment Variables, add `ANTHROPIC_API_KEY` with your key. Optionally add `SLATE_MODEL` if you want to override the default.
4. Deploy.

That gives you a live URL you can share. Because editions only unlock at set times, the refresh lock becomes genuinely binding once the app is deployed and running across sessions.

## A few honest notes

This is a prototype, and it behaves like one in a couple of places.

Settings do not persist yet. Goals, channels, and rules reset on reload. Adding storage (a small database, or the browser's own storage if you keep it personal) is the natural next step.

The YouTube Data API gives you 10,000 quota units a day, and search calls cost 100 each. Slate is deliberately frugal here, two queries per goal plus cheap channel pulls, which keeps a normal day well under the limit. The usage estimate in the corner of the feed helps you keep an eye on it.

The scorer defaults to Haiku because the judgments are short and the cost adds up across many videos. If you want sharper scoring and do not mind paying more, switch `SLATE_MODEL` to `claude-sonnet-4-6`.

## Why I made it

I wanted to see whether the thing that makes a feed addictive, its endlessness, could be replaced with the thing that makes a newspaper satisfying, its ending. Slate is my attempt at that. The constraint that started as a technical limit, a finite API budget, turned out to be the whole point.
