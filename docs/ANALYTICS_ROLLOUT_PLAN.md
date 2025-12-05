# Analytics Rollout Plan

This document captures the remaining operational work for the analytics refresh across SwapBack. It focuses on staging validation, stabilized testing, deployment, and live monitoring.

## 1. Staging Validation Checklist
1. **Environment Setup**
   - Copy `app/.env.example` into your staging `.env` and set `NEXT_PUBLIC_ANALYTICS_ENABLED=true`.
   - Provide both `NEXT_PUBLIC_MIXPANEL_TOKEN` and (optionally) `MIXPANEL_SERVER_TOKEN` when you want backend-only events to be authenticated independently from the browser token.
2. **Smoke Tests**
   - Load the staging app and ensure the router selector renders without client errors.
   - Trigger at least one swap quote and one full swap; confirm no network errors from `/api/swap` or `/api/swap/quote`.
3. **Telemetry Verification**
   - Use Mixpanel Live View filtered on the staging project token to confirm the following events:
     - `swap_request` and `swap_success` (frontend)
     - `server_swap_request`, `server_swap_success`, `server_swap_error` (backend)
     - `quote_request`, `quote_provider_fallback`, `quote_success`.
   - Each event should include `network`, `router`, and `environment` properties.
4. **Regression Checks**
   - Re-run targeted Vitest suites (`pnpm vitest run app/src/components/__tests__/RouterComparisonModal.test.tsx`).
   - Execute any e2e smoke tests against staging (skip analytics assertions to avoid flakes).

## 2. Vitest Stabilization
- The `vitest.config.ts` file now restricts discovery to project-owned tests inside `app/src`, `sdk/src`, and `tests/`. This prevents third-party Jest suites from executing under Vitest and ensures deterministic runs.
- If you need to add a new test location, update the `include` array rather than widening the glob pattern.
- Continue running targeted suites via `pnpm vitest run <path>` while the e2e layer remains under Playwright/Jest.

## 3. Deployment Preparation
1. **Pre-Deploy**
   - Merge verified telemetry changes to `main`.
   - Ensure staging Mixpanel data looks healthy for at least one hour of traffic.
   - Confirm no Rate Limit errors in `/api/swap` logs.
2. **Deploy**
   - Promote the Next.js build via your existing pipeline (Vercel/GitHub Actions).
   - Export the Mixpanel token secrets to the production environment (`NEXT_PUBLIC_MIXPANEL_TOKEN`, `MIXPANEL_SERVER_TOKEN`).
3. **Post-Deploy Validation**
   - Hit `/api/swap/quote` manually from production to prime caches.
   - Spot-check the Mixpanel Live View and ensure the production project receives both client and server events with `environment=production`.

## 4. Monitoring & Alerting
- **Dashboards**: Create Mixpanel saved reports for swap funnel metrics (`swap_request` → `swap_success`) split by router.
- **Alerts**: Configure Mixpanel or your logging provider to trigger when `server_swap_error` exceeds a 5% rate over 10 minutes.
- **Fallback Tracking**: Watch `quote_provider_fallback` counts; if a fallback occurs more than twice in 30 minutes, investigate the upstream router.

## 5. Next Steps
1. Automate the staging validation checklist inside CI (Nightly job running API smoke tests + Mixpanel API verification).
2. Extend vitest coverage to shared hooks once Jest-only packages are removed or shimmed.
3. Backfill documentation in `ANALYTICS_TELEMETRY_CHECKLIST.md` with direct links to Mixpanel saved reports once they exist.
