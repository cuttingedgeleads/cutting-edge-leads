# Authentication candidate dependency audit

The final lockfile is checked with `npm audit --json` and
`npm audit --omit=dev --json`. Both currently report **zero known vulnerabilities**.
Re-run both before release; this result is not a promise about future advisories.

## Scoped upgrades

- Next / eslint-config-next 16.3.5 and next-auth 4.24.15 close authentication and
  framework advisory paths.
- Nodemailer 10.0.10 replaces vulnerable 7.x for the SMTP reset path. NextAuth's
  optional 7.x peer is resolved through `next-auth.nodemailer = $nodemailer`.
  This application uses Credentials, not NextAuth's email provider. TypeScript,
  SMTP-adapter tests, production build, real credentials HTTP checks and separate
  live Gmail acceptance cover the exercised integrations.
- Sharp 0.35.4 matches the patched optional version used by Next.
- Resend 6.28.1 and compatible transitive updates remove its Svix/UUID path.
- Twilio's version and SMS application logic are unchanged; its compatible Axios,
  follow-redirects/form-data/qs tree is patched. No real SMS or payment calls are
  part of authentication QA.
- Compatible Babel, glob, browser-query and ESLint helpers were updated.

## Explicit, tested build/configuration overrides

The initial candidate still reported nine high package findings (three underlying
advisory paths with propagated parent findings). They were not dismissed as
"dev-only": Prisma config is installed through the client's optional peer, and
next-pwa is a production-declared build dependency.

- `@prisma/config -> deepmerge-ts@8.0.2` closes GHSA-ggr8-5vv4-36mx.
  A discriminating test merging two recursive object graphs exhausted the stack
  on 7.1.5 and succeeds on 8.0.2. Ordinary nested-object/array merge compatibility
  is also asserted. Prisma generation and the full build must pass with this
  deliberately scoped major override.
- `@prisma/config -> effect@3.22.2` closes GHSA-38f7-945m-qr2g, retaining the 3.x
  API. The app does not use Effect RPC; Prisma configuration generation is
  exercised by the canonical gate.
- `rollup-plugin-terser -> serialize-javascript@7.1.1` closes
  GHSA-5c6j-r48x-rmvq. A hostile Date output executed a harmless sentinel in a
  restricted VM under 4.0.0 and does not execute it under 7.1.1. A normal Date/RegExp
  serialization control remains valid. Production PWA generation and activated
  worker network-only/offline checks must pass with this scoped major override.

The new boundary checks are in `tests/auth-build-dependencies.test.mjs` and are
included automatically in `npm test`. These dependency constraints are part of
reviewed source, not a forceful `npm audit fix --force` or an application-framework
rollback. Preserve the lockfile and override rationale in subsequent updates.

## Verification boundary

The canonical gate includes real PostgreSQL transactions, type checking, a
production build, real NextAuth HTTP and phone-width desktop-browser behavior,
and activated service-worker checks. Separate hosted acceptance must prove Gmail
receipt and the complete reset/login lifecycle. Phone-width WebKit is not a
physical iPhone. Authentication tests do not certify unrelated billing workflows,
live SMS or every image-processing edge case.
