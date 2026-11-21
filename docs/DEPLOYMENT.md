# FixMate Backend Deployment Guide

This guide covers deploying the API to a Node.js host such as Render, Railway,
Fly.io, or a VPS. The app has no build step; it runs directly with Node.

## 1. Prerequisites

- Node.js 20.12 or newer (Node 24 recommended)
- A MongoDB deployment, preferably MongoDB Atlas
- A public HTTPS URL for the API
- A public HTTPS URL for the frontend
- Optional: Stripe account, ImgBB account

## 2. Production environment variables

Set these in the hosting provider's environment settings. Do not commit them.

### Required

| Variable | Example | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables secure production cookies |
| `PORT` | `5000` | Many hosts inject this automatically |
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB connection string |
| `DB_NAME` | `fixmate` | Production database name |
| `BETTER_AUTH_SECRET` | long random value | At least 32 random bytes recommended |
| `BETTER_AUTH_URL` | `https://api.example.com` | Public API origin, no trailing slash |
| `FRONTEND_URL` | `https://app.example.com` | Public frontend origin |

Generate a secret locally without printing it into source control:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Optional

| Variable | Purpose |
| --- | --- |
| `CORS_ORIGINS` | Comma-separated additional allowed origins |
| `STRIPE_SECRET_KEY` | Enables checkout creation and session verification |
| `STRIPE_WEBHOOK_SECRET` | Enables webhook signature verification |
| `PAYMENT_SUCCESS_URL` | Override the Stripe success redirect |
| `PAYMENT_CANCEL_URL` | Override the Stripe cancel redirect |
| `IMGBB_API_KEY` | Enables profile image uploads |
| `ADMIN_NAME`, `ADMIN_EMAIL` | Seed admin identity |
| `ADMIN_PASSWORD`, `SEED_PASSWORD` | Seed passwords, minimum 8 characters |
| `SEED_TECHNICIAN_1_*`, `SEED_TECHNICIAN_2_*`, `SEED_CUSTOMER_*` | Seed identities |
| `SEED_ALLOW_PRODUCTION` | Must be `true` to allow seeding with `NODE_ENV=production` |

If `FRONTEND_URL` is omitted in production, the server refuses to start. If
`BETTER_AUTH_URL` is omitted in production, the server also refuses to start.

## 3. MongoDB setup

1. Create an Atlas cluster and a database named `fixmate`.
2. Create a database user with read/write access to `fixmate`.
3. Add the hosting provider's outbound IPs to the Atlas network access list. For
   platforms with dynamic IPs, use `0.0.0.0/0` only as a deliberate tradeoff and
   rely on strong credentials and network controls.
4. Set `MONGODB_URI` and `DB_NAME`.

On startup the API:

- Connects to MongoDB.
- Creates indexes on `user`, `services`, `bookings`, and `payments`.
- Creates the `services`, `bookings`, and `payments` collections if missing.
- Lets BetterAuth create and manage its own `session`, `account`, and
  `verification` collections.

The application owns four collections: `user`, `services`, `bookings`, and
`payments`.

### Indexes

Important indexes include:

- Unique payment index on `bookingId`.
- Unique payment index on `stripeSessionId`.
- Unique partial booking index on `{ serviceId, customerEmail }` for active
  statuses, which prevents duplicate active bookings.
- Lookup indexes for customer, technician, status, approval, and payment queries.

Index creation is idempotent. If existing duplicate data prevents a unique index
from being created, the server logs a warning instead of crashing. Clean up the
duplicate data and restart to create the index.

### Test database cleanup

Integration tests create `fixmate_test_*` databases. The suite attempts to drop the
database after the run. If the MongoDB user cannot run `dropDatabase`, it drops each
collection, then deletes documents if collection drops are also not permitted. An
empty database shell may remain visible until an administrator removes it.

## 4. Deploy the API

### Generic steps

```bash
npm ci --omit=dev
npm start
```

Or with the host's build command set to `npm ci --omit=dev` and start command set
to `npm start`.

The server listens on `PORT` and defaults to `5000`.

### Render example

- Environment: Node
- Build command: `npm ci --omit=dev`
- Start command: `npm start`
- Health check path: `/api/health`
- Add all required environment variables.

### Railway / Fly.io / VPS

- Use the same build and start commands.
- Ensure the platform forwards `X-Forwarded-Proto` and terminates HTTPS.
- The app sets `trust proxy` to `1`, which is appropriate for a single proxy hop.

## 5. HTTPS, cookies, and CORS

In production (`NODE_ENV=production`) the app configures secure cookies:

- `httpOnly: true`
- `secure: true`
- `sameSite: "none"`

This supports a frontend and API on different sites. HTTPS is mandatory.

CORS allows:

- `FRONTEND_URL`
- Every origin listed in `CORS_ORIGINS`
- Requests with no `Origin` header, such as server-to-server calls

Credentials are enabled. Do not use wildcard origins with credentialed requests.
Set exact production origins, for example:

```dotenv
FRONTEND_URL=https://app.example.com
CORS_ORIGINS=https://www.example.com,https://staging.example.com
```

BetterAuth's `trustedOrigins` uses the same list.

## 6. Stripe configuration

### API keys

Set `STRIPE_SECRET_KEY` to a live or test secret key. Checkout uses dynamic
`price_data`, so no Stripe product or price needs to be created in advance.

### Webhook

Create a webhook endpoint in the Stripe Dashboard:

```text
https://api.example.com/api/payments/webhook
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

The webhook route is registered before JSON body parsing and uses the raw body for
signature verification. Do not add a proxy or middleware that rewrites the body.

### Redirect URLs

Defaults:

```text
${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}
${FRONTEND_URL}/payment/cancel
```

Override with `PAYMENT_SUCCESS_URL` and `PAYMENT_CANCEL_URL` if the frontend uses
different routes. Keep the `{CHECKOUT_SESSION_ID}` placeholder in the success URL
if the frontend calls `POST /api/payments/verify`.

The webhook is authoritative. The success page verification is a convenience and
is idempotent with the webhook.

### Local webhook testing

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Use the printed `whsec_...` value as `STRIPE_WEBHOOK_SECRET` for local testing.

## 7. ImgBB configuration

1. Create an ImgBB account and API key.
2. Set `IMGBB_API_KEY`.
3. Profile image uploads accept JPEG, PNG, WebP, or GIF up to 5 MB.

If the key is missing, `PATCH /api/profile/image` returns `503` with a clear
configuration message. Other profile updates continue to work.

## 8. Seeding

Seeding is optional and intended for demos or initial setup.

```bash
npm run seed:admin
npm run seed
```

Both scripts are idempotent. They require `ADMIN_PASSWORD` and `SEED_PASSWORD` to
be set to values of at least 8 characters.

Production guard:

- Seeding refuses to run when `NODE_ENV=production`.
- To intentionally seed production, set `SEED_ALLOW_PRODUCTION=true` for the run.
- Remove seed passwords from the environment afterward if they are no longer
  needed.
- Change seeded passwords before exposing the environment publicly.

The full seed creates demo services, bookings, and a paid payment. Do not run it on
a production database that must contain only real data.

## 9. Verify the deployment

### Health

```bash
curl -i https://api.example.com/api/health
```

Expect `200` and `"status": "ok"`.

### Authentication

```bash
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","password":"..."}' \
  https://api.example.com/api/auth/sign-in/email
```

Then:

```bash
curl -i -b cookies.txt https://api.example.com/api/profile
```

### Public services

```bash
curl https://api.example.com/api/services
```

### Admin access

Sign in as an admin, reuse the cookie, then:

```bash
curl -b cookies.txt https://api.example.com/api/admin/stats
```

### Stripe webhook

Use the Stripe Dashboard's test event or the Stripe CLI. A valid event should return
`200`. Replaying the same session should return `alreadyProcessed: true`.

## 10. Security checklist

- [ ] `.env` is not committed and is not present in the deployment artifact.
- [ ] `BETTER_AUTH_SECRET` is long, random, and unique per environment.
- [ ] `BETTER_AUTH_URL` and `FRONTEND_URL` use HTTPS in production.
- [ ] CORS origins are exact production origins, not `*`.
- [ ] MongoDB user has the minimum required privileges.
- [ ] Atlas network access is restricted where possible.
- [ ] Stripe webhook secret is set and the endpoint uses HTTPS.
- [ ] ImgBB key is set only if profile image upload is required.
- [ ] Seeded demo accounts and passwords are changed or removed.
- [ ] Backups and monitoring are enabled for MongoDB.
- [ ] Logs do not contain passwords, session cookies, or secret keys.

## 11. Operational notes

- **Rate limiting:** not implemented. Add a reverse-proxy or application-level rate
  limiter before exposing the API to untrusted traffic at scale.
- **Email verification and password reset:** not implemented.
- **Admin creation:** promote a user through an existing admin, or use
  `npm run seed:admin`.
- **Graceful shutdown:** the server handles `SIGINT` and `SIGTERM`, closes the HTTP
  server, and closes the MongoDB client.
- **Health checks:** use `/api/health` for platform health probes.
- **Logs:** unexpected server errors are logged; client-facing 500 responses are
  masked.

## 12. Troubleshooting

### `401` after sign-in

- Confirm the frontend sends credentials (`credentials: "include"`).
- Confirm `FRONTEND_URL` and the actual browser origin match.
- Confirm the API is served over HTTPS in production.
- Check that the browser accepted the session cookie. `SameSite=None` requires
  `Secure`, which requires HTTPS.

### `403` on an expected route

- Confirm the account role in `GET /api/profile`.
- Only technicians can create services and manage assigned bookings.
- Only customers can create bookings and pay.
- Only admins can use `/api/admin/*`.

### `503` on checkout or image upload

- Checkout: `STRIPE_SECRET_KEY` is missing.
- Webhook: `STRIPE_WEBHOOK_SECRET` is missing.
- Image upload: `IMGBB_API_KEY` is missing.

### `400` on the Stripe webhook

- The `stripe-signature` header is missing or invalid.
- The raw body was modified by a proxy or JSON parser.
- The signing secret does not match the endpoint.

### `409` when creating a booking

The customer already has an active booking (`requested`, `accepted`, or
`in-progress`) for that service. Cancel or complete the existing booking first.

### Server exits at startup

Check for a missing required variable:

- `MONGODB_URI`
- `DB_NAME`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` (production only)
- `FRONTEND_URL` (production only)

## 13. Rollback

- Redeploy the previous known-good commit.
- Index creation is additive and idempotent.
- There are no destructive migrations in this project.
- If a deployment introduced bad data, restore from a MongoDB backup rather than
  dropping collections manually.
