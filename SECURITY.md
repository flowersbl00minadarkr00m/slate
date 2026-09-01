# Security Policy

Slate is a self-hosted, single-user YouTube front end. The canonical release
surface is the flat repository root; credentials are supplied by each operator
through server-side environment variables and are never part of browser state
or backups.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through the maintainer contact
associated with the channel that provided this source. Do not open a public
issue with credentials, connection strings, private URLs, user goals, or a
reproduction that includes sensitive data. Redact those values and include the
affected route or file, impact, reproduction steps, and a safe suggested fix.

The canonical public repository and its private reporting endpoint are not yet
published. A repository-hosted private report channel can be added when that
canonical publication exists.

## Deployment security notes

- Keep `OPENAI_API_KEY`, `YOUTUBE_API_KEY`, Supabase service credentials, and
  Postgres connection strings in server-only deployment configuration.
- Keep `SLATE_API_ENABLED=0` until the operator has configured the required
  providers and intentionally enabled generation. `/api/health` reports only
  bounded readiness information.
- Vercel is the authoritative production target. The root `vercel.json`
  contains source-level security headers, but deployed header, health, and WAF
  evidence remains pending the separately authorized T5 release operation.
- The in-process request limiter is a local defense-in-depth backstop. It is
  not a deployment-wide rate limit; production-wide throttling must be verified
  through the Vercel WAF release checklist.
