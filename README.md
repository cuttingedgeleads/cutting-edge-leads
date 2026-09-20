# Cutting Edge Leads

Next.js App Router, PostgreSQL/Prisma, NextAuth credentials, and Tailwind CSS.

## Safe local authentication QA

Use Node.js 22 or newer and PostgreSQL 17. Work from this repository directory.
Install the lockfile with `npm ci --ignore-scripts`; the gate generates Prisma's
client explicitly. Do not copy production environment files or credentials.
The local gate refuses dotenv files and passes only allowlisted OS variables to
children, with a newly generated shared local authentication secret. Gmail,
Resend, PayPal, Twilio and other application configuration is not inherited.

Have an administrator provision ONLY this disposable database and role separately:

- host: `127.0.0.1`, port: `55474`
- database: `leads_auth_qa`, role: `leads_qa`
- loopback trust authentication (never expose this listener publicly)

The initializer never creates a database or connects to an administrative database.
For an already-provisioned EMPTY dedicated database only:

```sh
node tests/init-auth-db.mjs --empty-local-qa
```

This guarded, one-time initializer uses `db push` only to initialize an empty,
disposable QA database. It refuses existing tables. It is NOT a deployment or
migration command. Never run schema push, reset, seed, or migrate dev against a
shared database. Existing QA schemas need the reviewed additive migrations below,
not this initializer.

Run the full gate:

```sh
npm test
# Equivalent full gate:
npm run test:auth
# Faster service/unit + real PostgreSQL + TypeScript check (no build/browser):
npm run test:auth:unit
```

`AUTH_QA_EVIDENCE_DIR` optionally selects an evidence directory outside the checkout;
otherwise logs and `gate-result.json` go into ignored `.auth-qa/`. The gate:

1. refuses another concurrent gate via an exclusive checkout lock;
2. refuses an occupied port 3100 instead of killing or reusing someone else's server;
3. generates Prisma, runs serialized aggregate unit/real-PG suites, TypeScript,
   and the production webpack build;
4. owns a loopback Next server with the same random local secret as the tests,
   waits for bounded HTTP readiness, and runs real HTTP and installed Edge tests;
5. stops its server in `finally`, verifies the listener is gone, writes JSON
   evidence, and restores/removes only generated service-worker build outputs.

Install Microsoft Edge for the `msedge` browser channel. The browser tests use
390x844 phone-width desktop Edge emulation, not a physical iPhone or Safari.
They exercise an activated service worker, prove auth paths are not cached, and
prove offline auth requests fail even when a stale synthetic cache entry exists.
Test accounts use random passwords and generic `example.invalid` mailboxes. No
real email is sent. Suites delete only their own synthetic account/seed row IDs;
quota isolation uses the per-run secret, not global table truncation. If a gate
is forcibly killed by the OS, investigate its exact process ownership before
removing `.auth-qa.lock`; never stop an unrelated process or database server.

## Authentication runtime configuration

Configure these only in the authorized deployment environment, never tracked files:

- `DATABASE_URL`: reviewed PostgreSQL application connection.
- `NEXTAUTH_SECRET`: cryptographically random server secret, stable across instances.
- `NEXTAUTH_URL`: canonical application origin.
- `AUTH_TRUSTED_ORIGIN`: optional server-only explicit origin. Production accepts
  the canonical application origin; an HTTPS preview origin requires explicit
  configuration and `VERCEL_ENV=preview`. Request Host headers never select links.
- `PASSWORD_RESET_EMAIL_TRANSPORT`: `resend` by default, or explicitly `gmail`.
- Resend mode requires `RESEND_API_KEY` and retains the existing sender behavior.
- Gmail mode requires `GMAIL_SMTP_USER` (one lowercase Gmail mailbox) and
  `GMAIL_SMTP_APP_PASSWORD` (nonblank application password). For example the
  *shape* of a configured user is `synthetic.sender@gmail.com`; this is not a
  default sender and must not be used as a recipient fixture on a live provider.

Gmail always uses `smtp.gmail.com:465`, implicit TLS with certificate validation,
bounded connection/greeting/socket timeouts, and no pooling, retries or debug
logging. The From display is `Cutting Edge Leads`, with address and envelope sender
exactly equal to the authenticated configured Gmail user. There is only one
validated canonical account recipient, with structured address/envelope fields;
no BCC, default recipient or fallback to another provider. Transport failures
produce only `RESET_MAIL_UNAVAILABLE`. Provider acceptance is not proof of inbox
delivery; independent live mailbox/configuration proof is a separate release gate.
Unrelated notification and purchase mail still uses its existing Resend path.

Passwords require at least eight characters and at most 72 UTF-8 bytes. Durable
sessions have absolute 30-day remembered or 24-hour session-only deadlines.
Browser session restore behavior varies by browser; server expiration/revocation
remains authoritative. Refresh and client updates cannot extend those deadlines.
Legacy JWTs are limited to their original 24-hour issuance deadline and checked
against `passwordChangedAt`. Password reset/change atomically replaces the hash
and revokes sessions and reset tokens. Reset links expire in one hour, are stored
as digests, and legacy raw tokens are accepted only within the same bounds.
Database-enforced hourly request budgets are 3/email, 10/IP, and 100/global;
provider rejections retain consumed quotas. Deployments must supply trustworthy
proxy IP headers; these limits are not a substitute for edge abuse protection.

## Exact additive migration procedure

Do not replay old migration history blindly on an existing/shared schema. Before
any authorized deployment, back up and restore-test the database separately,
inspect migration history and ownership, and confirm the following objects are
absent (or already match a previously applied migration). These files intentionally
fail on duplicate application rather than hide drift.

Apply only these two reviewed files, in order, to the explicitly approved target.
Each file contains its own transaction and touches only Leads authentication data:

```sh
psql "$APPROVED_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/20260920000100_leads_auth_sessions/migration.sql
psql "$APPROVED_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/20260920000200_leads_reset_attempts/migration.sql
```

The first adds nullable `User.passwordChangedAt`, `LeadAuthSession`, its foreign
key and two indexes. The second adds `LeadResetAttempt` and its key/time index.
No destructive synchronization, shared-table reset, or customer migration occurs.
Record the two applications in the deployment migration ledger; if Prisma history
is the ledger in that environment, mark only those successfully applied migrations
with `prisma migrate resolve --applied <exact-directory-name>` under the SAME
explicitly reviewed `DATABASE_URL`. Do not use migrate deploy until the entire
existing migration history is reconciled. Generate the Prisma client, deploy the
new runtime to every instance, and verify reset replay, copied-cookie revocation,
and both cookie modes before enabling traffic. These are operator instructions,
not authorization to execute against any hosted/shared database.

Rollback: retain the additive columns/tables and revocation data. Roll back only
to a runtime that still enforces durable sessions, absolute legacy deadlines,
`passwordChangedAt`, atomic token consumption and bounded password handling.
Do NOT restore the old authentication runtime after resets: it can replay revoked
cookies or mishandle credentials. If a security-preserving rollback is unavailable,
fail closed/disable authentication until fixed rather than silently weaken it.
Do not restore an old database snapshot over post-reset revocation records.

## Build artifacts and dependency risk

`src/worker/sw.js` is the service-worker source. `public/sw.js`, hashed worker and
Workbox outputs are generated by `npm run build` and intentionally not versioned.
Old generated tracked artifacts are removed by this candidate. Always build before
`npm start`; do not deploy a source checkout's stale worker. The QA gate cleans its
generated outputs, so run a fresh authorized build for a later standalone server.
Uploads and generated workers are excluded from precaching.

See `docs/auth-dependency-audit.md` for the remaining audit paths and applicability.
The gate is implementation evidence, not independent review, physical-device proof,
or authorization to deploy or change live accounts.
