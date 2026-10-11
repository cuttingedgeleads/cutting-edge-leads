# Local import QA and parent release notes

Run from C:/Users/User/ce-leads-handoff-live. Do not use a production .env. Harness refuses local dotenv files and constructs OS-only child environments with explicit fictional credentials. Runtime dependency pins remain unchanged.

Commands (bash):

    node tests/run-import-qa.mjs unit finish-unit
    node tests/run-import-qa.mjs db finish-db
    node tests/run-import-qa.mjs generate finish-generate
    node tests/run-import-qa.mjs build finish-build
    IMPORT_QA_PLAYWRIGHT_DRIVER='C:/Users/User/ce-studio-leads-handoff/node_modules/playwright' node tests/run-import-qa.mjs browser-production finish-browser
    node tests/run-import-qa.mjs tsc finish-tsc

The explicit driver path is test-only and read-only. This machine's sibling driver is Playwright 1.55.1 with Chromium 140.0.7339.186 and WebKit 26.0. It uses that package's own compatible executable discovery, not hardcoded binaries. No browser download is required. Browser version is printed every run. A different machine must supply its own compatible installed package. Never pair WebKit 2203 with Playwright 1.63.

QA is ONLY postgresql://handoff_qa@127.0.0.1:55581/ce_leads_handoff_qa. Parent owns PostgreSQL lifecycle. Never use 55472/55474 or another database. Browser runner reserves 127.0.0.1:3181, refuses an occupied port, records its child PID, stops only its own child with a bounded wait, and checks that the port is free. Cleanup deletes only the exact owned import-qa@example.invalid fixture and its linked QA imports/leads/sessions/audits; engine tests also clean in finally, including launch failures. Do not run concurrently with another build/server owner. Tests use distinct synthetic loopback forwarded-IP headers per browser to avoid colliding in the existing global 100 requests/minute rate limiter; no production rate-limit code is changed.

The legacy auth HTTP/browser safety test combines page offline emulation with explicit rejection of the activated worker's global fetch transport. It leaves the actual fetch handler and deliberately poisoned caches intact, requires request rejection for auth and private import paths, and verifies the poison remains unused. This is labeled fault injection, NOT physical-device offline proof. The prior failed auth gate remains failed historical evidence; the repaired gate requires a fresh parent-owned run.

Evidence: .handoff-qa/*.log; engine-view-width.png and matching JSON contain populated screen captures plus DOM text and geometry at 390, 1280, and 320px. This is desktop engine/device-size simulation, NOT physical iPhone Home Screen proof. Worker tests execute the actual worker notificationclick handler with a worker-API harness; external OS push delivery is not simulated as passed.

Production requirements (parent only; not executed here):
- DATABASE_URL points to the existing shared Neon/public schema. Both applications' tables must survive all operations and backups.
- STUDIO_IMPORT_SECRET: matching Studio LEADS_IMPORT_SECRET, at least 32 bytes; do not put it in client/public variables or source.
- STUDIO_IMPORT_ENVIRONMENT=production; Studio LEADS_IMPORT_ENVIRONMENT=production.
- STUDIO_IMPORT_RECIPIENT_EMAIL: exact existing authorized ADMIN, lowercased. Existing auth NEXTAUTH_SECRET, NEXTAUTH_URL, and AUTH_TRUSTED_ORIGIN must retain the deployed trusted HTTPS origin.
- Studio LEADS_IMPORT_URL=https://www.cuttingedgeleads.net/api/integrations/studio/imports.
- Reuse existing NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT and existing installed-app manifest identity; do not rotate VAPID or install identity. Push preferences/subscriptions are honored. Missing push does not lose intake. A failed/unavailable attempt is throttled for 60 seconds; a later receipt replay can retry. No new recurring job is installed.
- Parent reviews/applies ONLY additive prisma/migrations/20261010000100_studio_import/migration.sql with schema-covering encrypted backups and existing migration history understood. It creates StudioImport plus its indexes/function/trigger and references existing User via the recipient foreign key; leadId is a unique retained historical identifier with no live Lead foreign key; no existing table is reset/renamed/dropped. Prisma model does not include Studio's other shared-schema tables: NEVER use destructive db push/reset to reconcile this schema.
- Historical migrations have baseline assumptions and are not rewritten. This local QA was already initialized by the previous worker from base schema + additive migration; do not run init against an existing/shared production database.
- Destination migration/application compatibility first, then paired Studio release under parent-owned deploy/README.md workflow. Sender/archive integration and independent final review belong to parent.
- Parent runs full auth/security/dependency gates after local server exit. Parent test-only fixed-loopback auth overrides are intentionally preserved.
- Physical iPhone installed Home Screen app: notification permission, OS notification tap, warm/cold activation, login continuation, and loaded Overview/import behavior still require actual device acceptance.
