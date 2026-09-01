# Slate release checklist

This checklist applies to the flat canonical root that is intended for public
release. It distinguishes source controls that can be reviewed in this tree
from deployment evidence that requires the separately authorized T5 operation.

## Source controls — T4

- [x] The Vite frontend and `api/` serverless boundary are rooted at this
  repository root; no nested application path is part of the release surface.
- [x] There is one root `.github/workflows/ci.yml` workflow with locked npm
  install, lint, full Vitest run, production build, production-only high-level
  audit, and bounded tracked-source credential scanning.
- [x] The workflow has read-only contents permission, a concurrency group,
  bounded job timeout, and immutable action revisions with version comments.
- [x] Dependabot monitors root npm and GitHub Actions dependencies weekly.
- [x] `vercel.json` provides the root SPA fallback and source-level security
  headers for the actual resource inventory.
- [x] `SECURITY.md` documents private reporting, server-only credentials, and
  the distinction between source controls and deployment controls.
- [x] README and contribution instructions describe the canonical root and the
  Vercel-primary deployment path; the CI badge targets only verified
  `canonical-v2` history.
- [x] Canonical Git history is published non-destructively on `canonical-v2`
  at `e896edf`; its push-triggered root CI run passed every required job.
- [x] README CI badge targets the verified `canonical-v2` workflow history and
  does not point at unrelated public `main` history.

## Resource and CSP contract — source review

- [x] Browser scripts, styles, fonts, and API connections are same-origin.
- [x] YouTube playback is framed only from `https://www.youtube.com`.
- [x] Runtime YouTube thumbnails are allowed from the YouTube image CDN via
  `https://*.ytimg.com`; no broad image wildcard is used.
- [x] No runtime Google Font request is part of the shipped demo path, and the
  favicon is local.
- [x] `style-src` and `style-src-elem` remain `'self'`.
- [x] `style-src-attr 'unsafe-inline'` is the exact limited exception required
  by four source style-attribute call sites: three runtime-computed
  progress-width attributes (two in `GoalMeter.jsx` and one in
  `ReviewView.jsx`) plus the pre-existing `Btn.jsx` variant style object used
  across the app's buttons. The current CSP function remains unchanged. This
  is **not** a strict style CSP claim; removing the exception requires
  migrating all four call sites, which is outside T4 or requires an explicitly
  approved disposition.
- [ ] Deployed CSP plus core ordinary/demo UI and YouTube thumbnail/embed
  behavior — **PENDING T5 deployed verification**.

## Source verification record

- [x] Canonical CI run for this source passed on `canonical-v2` at `e896edf`.
- [x] Release-owner reconciliation covers fresh `npm ci`, lint, 54/54 tests,
  build, production audit, workflow semantics, JSON/config validation, and
  tracked-source credential scanning; independent R1/R2 review approved the
  redacted release evidence before publication.

## Deployment and WAF evidence — T5 only

This section remains incomplete even though bounded deployment evidence now
exists. Checked items below are supported by the authenticated retry-4 checks;
unchecked WAF and full-browser items still block the final release verdict.

Observed retry 4 evidence (partial; not a release verdict):

- The single new canonical production deployment is READY and tied to commit `3c8be4328b5f3915b88249506e041c8e89eb46e8`.
- Authenticated `GET /api/health` returned bounded HTTP 200 ready state with generation and provider configuration enabled; no secret fields were exposed.
- Authenticated root response matched all nine checked-in security header values.
- Authenticated `GET /api/score` returned a generic JSON HTTP 404 without stack, upstream, or credential-shaped content.
- Authenticated ordinary and demo HTML shells contained the Slate root, title, and production asset markers. Full browser rendering was blocked by deployment-protection SSO.
- No Firewall rule or draft was created. WAF and legitimate generation verification remain pending because the configured cache path would perform Supabase schema/cache/run writes outside this retry authorization.

- [x] Canonical production deployment reached READY at source commit
  `3c8be4328b5f3915b88249506e041c8e89eb46e8`; the public checklist intentionally
  omits the operator-specific hostname.
- [x] Authenticated `GET /api/health` returned bounded HTTP 200 ready state
  without paid/provider work.
- [x] Representative deployed `Content-Security-Policy`, HSTS, referrer,
  permissions, nosniff, frame, opener, and resource-policy headers matched the
  checked-in contract.
- [ ] Core ordinary UI renders under the deployed CSP, including a
  representative YouTube thumbnail and playback/embed path — **PENDING T5**.
- [ ] WAF rule observed in log/observe mode for `/api/build-slate` — **PENDING
  T5**.
- [ ] WAF rule matches the approved source key, initial 10 requests per
  10-minute window, and intended observe-then-block action — **PENDING T5**.
- [ ] Normal generation traffic remains functional after enforcement —
  **PENDING T5**.
- [ ] Bounded excessive-request rejection, `Retry-After` where applicable, and
  recovery are observed across the deployment — **PENDING T5**.
- [ ] Rollback is verified as disabling only the Slate WAF rule — **PENDING T5**.

## Release verdict

**Not release-ready from this checklist alone.** Canonical Git/CI publication,
deployed health, and representative headers are verified. Full protected-browser
UI rendering plus observe/enforce/recovery/rollback WAF evidence remain explicit
T5 blockers.
