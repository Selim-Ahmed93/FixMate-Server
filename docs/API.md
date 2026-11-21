# FixMate API Reference

Base URL (local): `http://localhost:5000`

All request and response bodies are JSON unless noted otherwise. Authentication uses
BetterAuth cookie sessions. Browser clients must send credentials:

```js
fetch("http://localhost:5000/api/profile", {
  credentials: "include",
});
```

## Authentication

BetterAuth is mounted at `/api/auth`. The most relevant endpoints are:

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/sign-up/email` | Create a customer or technician account |
| `POST` | `/api/auth/sign-in/email` | Sign in and receive a session cookie |
| `POST` | `/api/auth/sign-out` | End the current session |
| `GET` | `/api/auth/get-session` | Return the current session, if any |

### Sign up

```http
POST /api/auth/sign-up/email
Content-Type: application/json
```

```json
{
  "name": "Nusrat Jahan",
  "email": "nusrat@example.com",
  "password": "a-strong-password",
  "role": "customer",
  "phone": "+8801712345678",
  "area": "Dhanmondi",
  "bio": "Homeowner in Dhaka"
}
```

- `role` may be `customer` or `technician`.
- Any other role, including `admin`, is coerced to `customer`.
- `phone`, `area`, and `bio` are optional.
- A session cookie is set on success.

### Sign in

```http
POST /api/auth/sign-in/email
Content-Type: application/json
```

```json
{
  "email": "nusrat@example.com",
  "password": "a-strong-password"
}
```

### Sign out

```http
POST /api/auth/sign-out
```

The session cookie is invalidated.

## Common error format

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

| Status | Meaning |
| --- | --- |
| `400` | Validation error, invalid state transition, or malformed input |
| `401` | Missing, invalid, or expired session |
| `403` | Authenticated but not allowed to perform the action |
| `404` | Resource not found |
| `409` | Conflict, such as a duplicate active booking or existing payment |
| `500` | Unexpected server error (message is masked) |
| `502` | Upstream integration failure (Stripe or ImgBB) |
| `503` | Integration is not configured |

## System

### `GET /`

Returns a simple welcome message.

### `GET /api/health`

Checks the API and database connection.

```json
{
  "success": true,
  "status": "ok",
  "message": "FixMate API is healthy",
  "uptime": 12.34,
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Returns `503` if MongoDB cannot be reached.

## Profile

All profile routes require authentication.

### `GET /api/profile`

Returns the authenticated user's profile.

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "user": {
    "_id": "665f...",
    "name": "Nusrat Jahan",
    "email": "nusrat@example.com",
    "role": "customer",
    "phone": "+8801712345678",
    "area": "Dhanmondi",
    "bio": "Homeowner in Dhaka",
    "image": "https://...",
    "emailVerified": false,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### `PATCH /api/profile`

Updates allowed profile fields. At least one field is required.

```json
{
  "name": "Nusrat Jahan",
  "phone": "+8801812345678",
  "area": "Gulshan",
  "bio": "Updated bio",
  "image": "https://example.com/avatar.png"
}
```

- `role` and other privileged fields are ignored.
- `image` must be an HTTP or HTTPS URL, or `null` / `""` to clear it.
- `phone` must look like a phone number (7–25 characters).

### `PATCH /api/profile/image`

Uploads an image to ImgBB and saves the returned URL on the profile.

```http
PATCH /api/profile/image
Content-Type: multipart/form-data
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `image` | file | Yes | JPEG, PNG, WebP, or GIF; maximum 5 MB |

Success:

```json
{
  "success": true,
  "message": "Profile image updated successfully",
  "imageUrl": "https://i.ibb.co/...",
  "user": { "...": "..." }
}
```

Returns `503` when `IMGBB_API_KEY` is not configured.

## Services

### `GET /api/services`

Public. Returns approved services that are currently available.

```json
{
  "success": true,
  "message": "Services retrieved successfully",
  "totalServices": 12,
  "services": []
}
```

### `GET /api/services/:id`

Public. Returns one approved and available service. Returns `404` for pending,
rejected, unavailable, or missing services.

### `POST /api/services`

Technician only. Creates a service in `pending` approval state.

```json
{
  "title": "Washing Machine Repair",
  "category": "Appliance Repair",
  "description": "Diagnosis and repair for front-load and top-load machines.",
  "image": "https://example.com/service.jpg",
  "basePrice": 45,
  "estimatedDuration": "60 minutes",
  "serviceMode": "On-site",
  "serviceArea": "Dhaka"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | Yes | 3–100 characters |
| `category` | string | Yes | 2–60 characters |
| `description` | string | Yes | 10–2000 characters |
| `image` | string \| null | No | HTTP/HTTPS URL |
| `basePrice` | number | Yes | Positive number |
| `estimatedDuration` | string | Yes | 1–100 characters |
| `serviceMode` | string | Yes | 1–50 characters, e.g. `On-site` |
| `serviceArea` | string | Yes | 1–100 characters |

`technicianName` and `technicianEmail` are taken from the authenticated user.

Success: `201`

```json
{
  "success": true,
  "message": "Service created successfully. Admin approval is required.",
  "serviceId": "665f..."
}
```

### `GET /api/services/technician`

Technician only. Returns all services owned by the authenticated technician,
including pending and rejected services.

### `PATCH /api/services/:id`

Technician owner only. Accepts any subset of the create fields. Updating a service
resets `approvalStatus` to `pending`, so it must be approved again.

### `DELETE /api/services/:id`

Technician owner only. Deletes the service.

### `PATCH /api/services/:id/approval`

Admin only. Generic approval route.

```json
{
  "status": "approved"
}
```

`status` must be `approved` or `rejected`.

> Admins can also use `PATCH /api/admin/services/:id/approve` and
> `PATCH /api/admin/services/:id/reject`.

## Bookings

### `POST /api/bookings`

Customer only. Creates a booking from an approved, available service.

```json
{
  "serviceId": "665f...",
  "customerPhone": "+8801712345678",
  "address": "House 9, Road 2, Dhanmondi, Dhaka",
  "preferredDate": "2026-02-01T10:00:00.000Z",
  "problemDescription": "The machine stops during the spin cycle."
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `serviceId` | string | Yes | Valid MongoDB ObjectId |
| `customerPhone` | string | No | Falls back to the profile phone |
| `address` | string | Yes | 5–500 characters |
| `preferredDate` | string | Yes | Valid ISO date in the future |
| `problemDescription` | string | Yes | 5–1000 characters |

Service title, image, category, base price, technician details, and customer name
and email are copied from the service and session.

Success: `201`

```json
{
  "success": true,
  "message": "Booking created successfully",
  "bookingId": "665f..."
}
```

Errors:

- `403` — not a customer, or the technician is booking their own service.
- `400` — service is not approved or not available.
- `409` — the customer already has an active booking for this service.

### `GET /api/bookings/customer`

Customer only. Returns the authenticated customer's bookings, newest first.

```json
{
  "success": true,
  "message": "Customer bookings retrieved successfully",
  "totalBookings": 3,
  "bookings": []
}
```

### `GET /api/bookings/technician`

Technician only. Returns bookings assigned to the authenticated technician.

### `GET /api/bookings/:id`

Authenticated. Allowed for the booking's customer, the assigned technician, or an
admin. Other users receive `403`.

### `PATCH /api/bookings/:id/status`

Technician owner only. Accepts `accepted`, `rejected`, or `in-progress` according
to the lifecycle.

```json
{
  "status": "accepted"
}
```

Allowed transitions:

| Current | Allowed next |
| --- | --- |
| `requested` | `accepted`, `rejected` |
| `accepted` | `in-progress` |
| `in-progress` | Use `final-amount` to complete |
| `completed` | None |
| `rejected` | None |
| `cancelled` | None |

A generic `completed` status is rejected; completion must go through
`PATCH /api/bookings/:id/final-amount`.

### `PATCH /api/bookings/:id/final-amount`

Technician owner only. Completes an `in-progress` booking and records the final
amount.

```json
{
  "finalAmount": 90
}
```

`finalAmount` must be a positive number (not a numeric string).

Success returns the updated booking with `status: "completed"`.

### `PATCH /api/bookings/:id/cancel`

Customer owner only. Cancels a booking only while its status is `requested`.

Success:

```json
{
  "success": true,
  "message": "Booking cancelled successfully"
}
```

## Payments

### `POST /api/payments/checkout`

Customer only. Creates a Stripe Checkout Session for a completed, unpaid booking
owned by the customer.

```json
{
  "bookingId": "665f..."
}
```

Success:

```json
{
  "success": true,
  "message": "Checkout session created successfully",
  "bookingId": "665f...",
  "sessionId": "cs_test_...",
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

Errors:

- `400` — booking is not completed or not unpaid.
- `403` — not a customer, or not the booking owner.
- `409` — a payment already exists for the booking.
- `503` — `STRIPE_SECRET_KEY` is missing.
- `502` — Stripe rejected the request or could not be reached.

### `POST /api/payments/verify`

Customer only. Retrieves a Stripe Checkout Session and finalizes the payment. This
is intended for the success redirect page. The webhook remains authoritative.

```json
{
  "sessionId": "cs_test_..."
}
```

Success:

```json
{
  "success": true,
  "message": "Payment verified and saved successfully",
  "alreadyProcessed": false,
  "paymentId": "665f...",
  "payment": {}
}
```

### `GET /api/payments/history`

Customer only. Returns the authenticated customer's payments, newest first.

```json
{
  "success": true,
  "message": "Payment history retrieved successfully",
  "totalPayments": 1,
  "payments": []
}
```

### `GET /api/payments/booking/:bookingId`

Authenticated. Allowed for the booking's customer, the assigned technician, or an
admin. Returns the payment for a booking.

### `GET /api/payments/all`

Admin only. Supports optional query parameters:

| Query | Values | Description |
| --- | --- | --- |
| `status` | `paid`, `unpaid` | Filter by payment status |
| `search` | string | Search service, customer, technician, or transaction ID |

### `POST /api/payments/webhook`

Stripe webhook endpoint. Requires a valid `stripe-signature` header and the raw
request body. Configure Stripe to send:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Processing rules:

- The event must be paid and complete.
- The booking must exist and be `completed` and `unpaid`, unless the same session
  was already processed.
- Currency must be `usd`.
- `amount_total` must equal `finalAmount * 100`.
- The Stripe customer email must match the booking customer.
- One payment is stored per booking.
- Replaying the same session is idempotent and returns `alreadyProcessed: true`.
- A different session for an already-paid booking is ignored.

A valid but unsupported or state-invalid event returns `200` with `ignored: true`
so Stripe does not retry forever. Invalid signatures return `400`. Missing webhook
configuration returns `503`.

## Admin

All admin routes require authentication with the `admin` role.

### `GET /api/admin/users`

| Query | Values | Description |
| --- | --- | --- |
| `role` | `customer`, `technician`, `admin` | Filter by role |
| `search` | string | Search name or email |

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "totalUsers": 4,
  "users": []
}
```

### `GET /api/admin/users/:id`

Returns one user.

### `PATCH /api/admin/users/:id/role`

```json
{
  "role": "technician"
}
```

Rules:

- Role must be `customer`, `technician`, or `admin`.
- An admin cannot change their own role.
- The last remaining admin cannot be demoted.

### `GET /api/admin/services`

| Query | Values | Description |
| --- | --- | --- |
| `status` | `pending`, `approved`, `rejected` | Filter by approval status |
| `available` | `true`, `false` | Filter by availability |
| `search` | string | Search title, category, technician name, or email |

### `PATCH /api/admin/services/:id/approve`

Approves a service and makes it visible in the public listing when available.

### `PATCH /api/admin/services/:id/reject`

Rejects a service and hides it from the public listing.

### `GET /api/admin/bookings`

| Query | Values | Description |
| --- | --- | --- |
| `status` | Any booking status | Filter by status |
| `search` | string | Search service, customer, or technician fields |

### `GET /api/admin/payments`

Same filters as `GET /api/payments/all`.

### `GET /api/admin/stats`

Returns dashboard counts and revenue.

```json
{
  "success": true,
  "message": "Dashboard statistics retrieved successfully",
  "stats": {
    "totalUsers": 4,
    "totalCustomers": 1,
    "totalTechnicians": 2,
    "totalAdmins": 1,
    "totalServices": 12,
    "pendingServices": 0,
    "approvedServices": 12,
    "totalBookings": 7,
    "completedBookings": 2,
    "totalPayments": 1,
    "totalRevenue": 55
  }
}
```

## Data shapes

### Service

```json
{
  "_id": "665f...",
  "title": "Washing Machine Repair",
  "category": "Appliance Repair",
  "description": "Diagnosis and repair for front-load and top-load machines.",
  "image": "https://...",
  "basePrice": 45,
  "estimatedDuration": "60 minutes",
  "serviceMode": "On-site",
  "serviceArea": "Dhaka",
  "technicianName": "Rahim Uddin",
  "technicianEmail": "technician1@fixmate.local",
  "approvalStatus": "approved",
  "isAvailable": true,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### Booking

```json
{
  "_id": "665f...",
  "serviceId": "665f...",
  "serviceTitle": "Washing Machine Repair",
  "serviceImage": "https://...",
  "category": "Appliance Repair",
  "basePrice": 45,
  "technicianName": "Rahim Uddin",
  "technicianEmail": "technician1@fixmate.local",
  "customerName": "Nusrat Jahan",
  "customerEmail": "nusrat@example.com",
  "customerPhone": "+8801712345678",
  "address": "House 9, Road 2, Dhanmondi, Dhaka",
  "preferredDate": "2026-02-01T10:00:00.000Z",
  "problemDescription": "The machine stops during the spin cycle.",
  "status": "requested",
  "finalAmount": 45,
  "paymentStatus": "unpaid"
}
```

### Payment

```json
{
  "_id": "665f...",
  "bookingId": "665f...",
  "serviceTitle": "Washing Machine Repair",
  "customerName": "Nusrat Jahan",
  "customerEmail": "nusrat@example.com",
  "technicianName": "Rahim Uddin",
  "technicianEmail": "technician1@fixmate.local",
  "amount": 90,
  "currency": "usd",
  "transactionId": "pi_...",
  "stripeSessionId": "cs_test_...",
  "paymentStatus": "paid",
  "paidAt": "2026-01-01T00:00:00.000Z"
}
```
