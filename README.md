# FixMate Backend

FixMate is a home-service marketplace API. Customers book approved services from
technicians, technicians manage their services and booking lifecycle, and admins
approve services, manage users, and review platform activity. Payments are handled
through Stripe Checkout, with a signed webhook as the source of truth.

This repository contains the **backend only**. The frontend is maintained separately.

## Highlights

- BetterAuth email/password authentication with cookie sessions.
- Role-based access for `customer`, `technician`, and `admin`.
- Technician service CRUD with admin approval and re-approval after edits.
- Customer booking flow with ownership checks and guarded status transitions.
- Technician completion flow that records the final amount.
- Stripe Checkout creation, redirect verification, and signed webhook handling.
- Idempotent payment recording: one payment per booking.
- Profile updates and ImgBB-backed profile image upload.
- Admin user management, role updates, dashboard statistics, and platform lists.
- MongoDB indexes created on startup, including a unique partial index that blocks
  duplicate active bookings for the same customer and service.
- Automated unit and integration tests using Node's built-in test runner.

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 20.12+ (developed on Node 24) |
| HTTP | Express 5 |
| Database | MongoDB (MongoDB Node driver 7) |
| Auth | BetterAuth 1.7 with the MongoDB adapter |
| Payments | Stripe Checkout + signed webhooks |
| Images | ImgBB API + Multer memory uploads |
| Tests | `node:test` and `node:assert/strict` |

## Collections

The application owns four collections:

| Collection | Purpose |
| --- | --- |
| `user` | BetterAuth users plus `role`, `phone`, `area`, `bio`, and `image` fields |
| `services` | Technician services and approval state |
| `bookings` | Customer bookings, lifecycle state, and payment state |
| `payments` | Verified Stripe payments, one per booking |

BetterAuth also manages its own `session`, `account`, and `verification`
collections. Application code never writes to those collections directly.

## Roles and permissions

| Capability | Customer | Technician | Admin |
| --- | --- | --- | --- |
| Sign up / sign in | Yes | Yes | Created by seed or promoted by an admin |
| Browse approved services | Yes | Yes | Yes |
| Create / edit / delete own services | No | Yes | No |
| Approve or reject services | No | No | Yes |
| Create bookings | Yes | No | No |
| View own bookings | Yes | Yes (assigned) | Yes (all) |
| Accept / reject / start bookings | No | Yes (assigned) | No |
| Complete booking with final amount | No | Yes (assigned) | No |
| Cancel a requested booking | Yes (own) | No | No |
| Pay for a completed booking | Yes (own) | No | No |
| View payment history | Yes (own) | Own booking payments | Yes (all) |
| Manage users and roles | No | No | Yes |
| View dashboard statistics | No | No | Yes |

Public sign-up accepts only `customer` and `technician`. Any other requested role,
including `admin`, is coerced to `customer`.

## Booking lifecycle

```text
requested ──> accepted ──> in-progress ──> completed (final amount required)
    │
    ├──> rejected   (technician)
    └──> cancelled  (customer, only while requested)
```

- Only one active booking (`requested`, `accepted`, `in-progress`) is allowed per
  customer and service. The API returns `409` for a duplicate.
- A technician cannot book their own service.
- A booking can only be paid after it is `completed` and still `unpaid`.
- Completing a booking requires a positive numeric `finalAmount`.

## Quick start

### 1. Requirements

- Node.js 20.12 or newer
- A MongoDB deployment (local MongoDB or MongoDB Atlas)
- Optional: Stripe test keys and an ImgBB API key for those integrations

### 2. Install

```bash
cd BackEnd
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Fill in at least:

```dotenv
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
DB_NAME=fixmate
BETTER_AUTH_SECRET=<long random secret>
BETTER_AUTH_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

Never commit `.env`. The repository ignores `.env` and every `.env.*` file except
`.env.example`.

### 4. Run

```bash
npm run dev
```

The API starts on `http://localhost:5000` by default. Verify it with:

```bash
curl http://localhost:5000/api/health
```

### 5. Seed sample data (optional)

Set `ADMIN_PASSWORD` and `SEED_PASSWORD` in `.env` (minimum 8 characters), then:

```bash
npm run seed:admin   # create or update only the admin account
npm run seed         # create admin, 2 technicians, 1 customer, services, bookings, payment
```

Both scripts are idempotent. They refuse to run when `NODE_ENV=production` unless
`SEED_ALLOW_PRODUCTION=true` is explicitly set.

Default seed identities (override with the `SEED_*` and `ADMIN_*` variables):

| Role | Email |
| --- | --- |
| Admin | `admin@fixmate.local` |
| Technician | `technician1@fixmate.local` |
| Technician | `technician2@fixmate.local` |
| Customer | `customer@fixmate.local` |

Passwords come only from `ADMIN_PASSWORD` and `SEED_PASSWORD`.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the API with Node |
| `npm run dev` | Start with Nodemon |
| `npm run seed:admin` | Create/update the admin account |
| `npm run seed` | Seed demo users, services, bookings, and a payment |
| `npm test` | Run unit tests, then integration tests |
| `npm run test:unit` | Run validator unit tests only |
| `npm run test:integration` | Run the full API integration suite |

## Testing

The integration suite starts the real Express app against a temporary database
named `fixmate_test_<timestamp>_<random>`. It loads `.env` when present and
otherwise uses the process environment. `MONGODB_URI` is required, and the MongoDB
user must be able to create that database. After the run it drops the database; if
the user lacks `dropDatabase` permission, it drops each collection, then deletes
documents if collection drops are also not permitted.

```bash
npm test
```

Notes:

- Stripe is exercised with a dummy key and locally generated webhook signatures by
  default. Set `RUN_STRIPE_LIVE_TESTS=true` and a real test key to opt into live
  checkout creation.
- Set `TEST_KEEP_DB=true` to keep the test database for inspection.
- The suite covers authentication, role escalation attempts, service approval,
  booking transitions, ownership checks, profile validation, webhook idempotency,
  payment ownership, admin APIs, and health/error handling.
- The ImgBB upload test is skipped when `IMGBB_API_KEY` is configured, because a
  live external upload should be opt-in.

## API documentation

See [docs/API.md](docs/API.md) for endpoints, request bodies, status codes, and
example responses.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production environment variables,
MongoDB setup, Stripe webhook configuration, and verification steps.

## Project structure

```text
src/
  app.js                  Express app factory and route mounting
  server.js               Startup, env validation, graceful shutdown
  config/
    auth.js               BetterAuth configuration
    db.js                 MongoDB connection lifecycle
    indexes.js            Index creation
    origins.js            Frontend/CORS origin resolution
    stripe.js             Stripe client
  controllers/            HTTP request/response handling
  middleware/             Authentication, uploads, errors
  models/                 MongoDB queries and business rules
  routes/                 Express routers
  scripts/                Idempotent seed scripts
  services/               Stripe payment and ImgBB integrations
  utils/                  Errors, validation, controller helpers
tests/
  unit/                   Validator tests
  integration/            End-to-end API tests
  helpers/                Cookie-aware HTTP client
```

## Response format

Successful responses always include `success` and `message`, plus endpoint-specific
fields. For example:

```json
{
  "success": true,
  "message": "Services retrieved successfully",
  "totalServices": 12,
  "services": []
}
```

Other endpoints use keys such as `bookings`, `payments`, `user`, `stats`,
`serviceId`, or `sessionId`. Errors use:

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

Unknown server errors are masked as `Internal server error`. Known application
errors, such as a missing Stripe configuration, return a clear message and an
appropriate `4xx` or `5xx` status.

## Security notes

- Sessions are cookie-based and managed by BetterAuth.
- Public sign-up cannot create admins.
- Role changes are admin-only; admins cannot change their own role, and the last
  admin cannot be demoted.
- Profile updates ignore role and other privileged fields.
- Ownership is checked for services, bookings, payments, and profile images.
- Stripe webhook signatures are verified against the raw request body.
- Payment amounts, currency, and customer email are validated against the booking.
- Uploads are limited to JPEG, PNG, WebP, or GIF files up to 5 MB.
- Passwords and secrets are never logged or committed.

## Current limitations

- Live Stripe checkout was not executed because the local `.env` does not contain
  `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`. Webhook processing is covered by
  automated tests using a dummy key and generated signatures.
- Live ImgBB upload was not executed because `IMGBB_API_KEY` is absent. Validation
  and the `503` configuration response are covered by tests.
- The production `fixmate` database has not been seeded because seed passwords are
  not present in the local environment.
- There is no email verification, password reset, refresh-token flow, or admin
  plugin. BetterAuth is the only authentication system.
