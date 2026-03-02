# Cutting Edge Leads (Local MVP)

Local lead marketplace MVP for a landscaping business.

## Stack
- Next.js (App Router)
- Prisma + SQLite
- NextAuth (credentials)
- Tailwind CSS

## Features
- Admin creates contractor accounts
- Admin creates leads (job type, description, city, zip, photos)
- Per-lead price floor validation (min $20)
- Contractors request purchase; admin approves unlocks manually
- Lead auto-hides after 24 hours
- Lead sold out after 2 approved unlocks
- Mobile-friendly UI
- Service-area filter placeholder

## Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Set environment variables
Copy `.env` and adjust if needed:
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-me"
EMAIL_ENABLED="false"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="cuttingedgechatbot@gmail.com"
SMTP_PASS=""
SMTP_FROM="cuttingedgechatbot@gmail.com"
```

### 3) Initialize database
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 4) Run the app
```bash
npm run dev
```

Visit http://localhost:3000

## Admin access
- Admin credentials are provisioned per environment.

## Usage
- Admin login → create contractor accounts and new leads
- Contractors login → request unlocks on available leads
- Admin approvals are manual (payments handled offline)

## Notes
- Leads auto-hide 24 hours after creation.
- Unlocks are capped at 2 per lead.
- Photo uploads are mocked as comma-separated URLs.
- Contractors only see leads in their service cities.
- Email notifications are disabled by default (EMAIL_ENABLED=false).
