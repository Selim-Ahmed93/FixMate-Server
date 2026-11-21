import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import Stripe from "stripe";

import { createClient } from "../helpers/client.js";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
process.loadEnvFile(envPath);

const getFreePort = () => {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
};

const port = await getFreePort();
const testDbName = `fixmate_test_${Date.now()}_${Math.random()
  .toString(16)
  .slice(2, 8)}`;

process.env.DB_NAME = testDbName;
process.env.NODE_ENV = "test";
process.env.PORT = String(port);
process.env.BETTER_AUTH_URL = `http://127.0.0.1:${port}`;
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ||
  "fixmate-test-secret-that-is-long-enough-for-better-auth";
process.env.ADMIN_PASSWORD = "TestAdminPass123!";
process.env.SEED_PASSWORD = "TestSeedPass123!";

if (process.env.RUN_STRIPE_LIVE_TESTS !== "true") {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
}

process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fixmate_automated";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required to run integration tests");
}

const { default: connectDB, closeDB, getDB } = await import(
  "../../src/config/db.js"
);
const { initializeAuth } = await import("../../src/config/auth.js");
const { createApp } = await import("../../src/app.js");
const { seedSampleData } = await import("../../src/scripts/seed.helpers.js");

const stripe = new Stripe("sk_test_dummy");
const suffix = Math.random().toString(36).slice(2, 8);
const testPassword = "TestUserPass123!";

let server;
let baseUrl;
let customerClient;
let otherCustomerClient;
let adminClient;
let tech1Client;
let tech2Client;

let newCustomerEmail;
let newCustomerId;
let otherCustomerEmail;
let otherCustomerId;

const signIn = async (client, email, password) => {
  const response = await client.request("/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password },
  });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(client.cookieHeader.length > 0, "Login did not set a session cookie");

  return response;
};

const signUp = async (client, { name, email, password, role }) => {
  return await client.request("/api/auth/sign-up/email", {
    method: "POST",
    body: { name, email, password, role },
  });
};

const futureDate = (days = 5) => {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
};

const pastDate = (days = 5) => {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
};

const createApprovedService = async (label) => {
  const serviceData = {
    title: `Automated ${label} ${suffix}`,
    category: "Electronics",
    description:
      "A service created by the FixMate automated backend integration test suite.",
    image: "https://placehold.co/600x400?text=FixMate+Test",
    basePrice: 55,
    estimatedDuration: "60 minutes",
    serviceMode: "On-site",
    serviceArea: "Dhaka",
  };

  const createResponse = await tech1Client.request("/api/services", {
    method: "POST",
    body: serviceData,
  });

  assert.equal(createResponse.status, 201, JSON.stringify(createResponse.body));

  const serviceId = createResponse.body.serviceId;

  const approveResponse = await adminClient.request(
    `/api/admin/services/${serviceId}/approve`,
    { method: "PATCH" },
  );

  assert.equal(approveResponse.status, 200, JSON.stringify(approveResponse.body));

  return { serviceId, serviceData };
};

const createBooking = async (client, serviceId, overrides = {}) => {
  return await client.request("/api/bookings", {
    method: "POST",
    body: {
      serviceId,
      customerPhone: "+8801712345678",
      address: "House 9, Road 2, Dhanmondi, Dhaka",
      preferredDate: futureDate(),
      problemDescription:
        "Automated test booking with a clearly described repair problem.",
      ...overrides,
    },
  });
};

const completeBooking = async (bookingId, amount) => {
  const accept = await tech1Client.request(`/api/bookings/${bookingId}/status`, {
    method: "PATCH",
    body: { status: "accepted" },
  });
  assert.equal(accept.status, 200, JSON.stringify(accept.body));

  const start = await tech1Client.request(`/api/bookings/${bookingId}/status`, {
    method: "PATCH",
    body: { status: "in-progress" },
  });
  assert.equal(start.status, 200, JSON.stringify(start.body));

  const complete = await tech1Client.request(
    `/api/bookings/${bookingId}/final-amount`,
    {
      method: "PATCH",
      body: { finalAmount: amount },
    },
  );
  assert.equal(complete.status, 200, JSON.stringify(complete.body));
};

const buildSessionEvent = ({
  bookingId,
  amount,
  currency = "usd",
  email = "customer@fixmate.local",
  sessionId = `cs_test_${suffix}_${Math.random().toString(36).slice(2, 8)}`,
  type = "checkout.session.completed",
  paymentStatus = "paid",
}) => {
  return {
    id: `evt_test_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    type,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        status: "complete",
        payment_status: paymentStatus,
        currency,
        amount_total: Math.round(amount * 100),
        customer_email: email,
        payment_intent: `pi_test_${Math.random().toString(36).slice(2, 8)}`,
        client_reference_id: bookingId,
        metadata: { bookingId },
      },
    },
  };
};

const sendWebhook = async (event, options = {}) => {
  const payload = JSON.stringify(event);
  const signature =
    options.signature ||
    stripe.webhooks.generateTestHeaderString({
      payload,
      secret: options.secret || process.env.STRIPE_WEBHOOK_SECRET,
    });

  const response = await fetch(baseUrl + "/api/payments/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: response.status, body };
};

before(async () => {
  await connectDB();
  const auth = initializeAuth();
  await seedSampleData();

  const app = createApp(auth);

  server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, "127.0.0.1", () => resolve(listener));
    listener.on("error", reject);
  });

  baseUrl = `http://127.0.0.1:${port}`;

  customerClient = createClient(baseUrl);
  otherCustomerClient = createClient(baseUrl);
  adminClient = createClient(baseUrl);
  tech1Client = createClient(baseUrl);
  tech2Client = createClient(baseUrl);

  await signIn(customerClient, "customer@fixmate.local", "TestSeedPass123!");
  await signIn(adminClient, "admin@fixmate.local", "TestAdminPass123!");
  await signIn(tech1Client, "technician1@fixmate.local", "TestSeedPass123!");
  await signIn(tech2Client, "technician2@fixmate.local", "TestSeedPass123!");
});

after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }

  await closeDB();

  if (
    testDbName.startsWith("fixmate_test_") &&
    process.env.TEST_KEEP_DB !== "true"
  ) {
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
      await client.connect();
      const testDb = client.db(testDbName);
      await testDb.dropDatabase();
    } catch {
      // Some managed MongoDB users cannot drop databases. Fall back to
      // deleting the documents from every collection in the test database.
      try {
        const testDb = client.db(testDbName);
        const collections = await testDb.listCollections().toArray();

        for (const { name } of collections) {
          await testDb.collection(name).deleteMany({});
        }
      } catch (error) {
        console.warn("Could not clean the test database:", error.message);
      }
    } finally {
      await client.close();
    }
  }
});

describe("FixMate backend API", () => {
  describe("Health and errors", () => {
    it("returns a healthy status", async () => {
      const response = await customerClient.request("/api/health");

      assert.equal(response.status, 200);
      assert.equal(response.body.status, "ok");
    });

    it("returns JSON for unknown routes", async () => {
      const response = await customerClient.request("/api/unknown-route");

      assert.equal(response.status, 404);
      assert.equal(response.body.success, false);
    });
  });

  describe("Authentication", () => {
    it("signs up a customer with the customer role", async () => {
      const client = createClient(baseUrl);
      newCustomerEmail = `customer-${suffix}@fixmate.test`;

      const response = await signUp(client, {
        name: "Automated Customer",
        email: newCustomerEmail,
        password: testPassword,
        role: "customer",
      });

      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.user.role, "customer");
      assert.ok(client.cookieHeader.length > 0);
      newCustomerId = response.body.user.id;
    });

    it("signs up a technician with the technician role", async () => {
      const client = createClient(baseUrl);
      const response = await signUp(client, {
        name: "Automated Technician",
        email: `technician-${suffix}@fixmate.test`,
        password: testPassword,
        role: "technician",
      });

      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.user.role, "technician");
    });

    it("coerces a public admin signup to customer", async () => {
      const client = createClient(baseUrl);
      const response = await signUp(client, {
        name: "Escalation Attempt",
        email: `escalation-${suffix}@fixmate.test`,
        password: testPassword,
        role: "admin",
      });

      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.user.role, "customer");
    });

    it("rejects a duplicate email", async () => {
      const client = createClient(baseUrl);
      const response = await signUp(client, {
        name: "Duplicate Customer",
        email: newCustomerEmail,
        password: testPassword,
        role: "customer",
      });

      assert.ok(response.status >= 400);
    });

    it("rejects an invalid password", async () => {
      const client = createClient(baseUrl);
      const response = await client.request("/api/auth/sign-in/email", {
        method: "POST",
        body: {
          email: "customer@fixmate.local",
          password: "wrong-password",
        },
      });

      assert.equal(response.status, 401);
    });

    it("invalidates the session on logout", async () => {
      const client = createClient(baseUrl);
      await signIn(client, "customer@fixmate.local", "TestSeedPass123!");

      const logout = await client.request("/api/auth/sign-out", {
        method: "POST",
      });
      assert.equal(logout.status, 200);

      const profile = await client.request("/api/profile");
      assert.equal(profile.status, 401);
    });

    it("blocks non-admin users from admin endpoints", async () => {
      assert.equal(
        (await customerClient.request("/api/admin/stats")).status,
        403,
      );
      assert.equal(
        (await tech1Client.request("/api/admin/stats")).status,
        403,
      );
    });

    it("requires authentication for protected routes", async () => {
      const client = createClient(baseUrl);
      assert.equal((await client.request("/api/profile")).status, 401);
      assert.equal(
        (await client.request("/api/bookings/customer")).status,
        401,
      );
    });
  });

  describe("Service management", () => {
    let serviceId;

    it("creates a pending service as a technician", async () => {
      const response = await tech1Client.request("/api/services", {
        method: "POST",
        body: {
          title: `Service Lifecycle ${suffix}`,
          category: "Electronics",
          description:
            "Service lifecycle test covering creation, approval, update and deletion.",
          image: "https://placehold.co/600x400?text=Lifecycle",
          basePrice: 55,
          estimatedDuration: "60 minutes",
          serviceMode: "On-site",
          serviceArea: "Dhaka",
        },
      });

      assert.equal(response.status, 201, JSON.stringify(response.body));
      serviceId = response.body.serviceId;
    });

    it("hides pending services from public APIs", async () => {
      const detail = await customerClient.request(`/api/services/${serviceId}`);
      assert.equal(detail.status, 404);

      const list = await customerClient.request("/api/services");
      assert.equal(list.status, 200);
      assert.ok(
        !list.body.services.some((service) => service._id === serviceId),
      );
    });

    it("shows the service to its owner", async () => {
      const response = await tech1Client.request("/api/services/technician");

      assert.equal(response.status, 200);
      assert.ok(
        response.body.services.some((service) => service._id === serviceId),
      );
    });

    it("prevents another technician from updating the service", async () => {
      const response = await tech2Client.request(`/api/services/${serviceId}`, {
        method: "PATCH",
        body: { title: "Unauthorized update" },
      });

      assert.equal(response.status, 403);
    });

    it("prevents customers from creating services", async () => {
      const response = await customerClient.request("/api/services", {
        method: "POST",
        body: {
          title: "Customer service",
          category: "Test",
          description: "Customers must not create services.",
          basePrice: 10,
          estimatedDuration: "10 minutes",
          serviceMode: "On-site",
          serviceArea: "Dhaka",
        },
      });

      assert.equal(response.status, 403);
    });

    it("lets an admin list and approve the service", async () => {
      const pending = await adminClient.request(
        "/api/admin/services?status=pending",
      );

      assert.equal(pending.status, 200);
      assert.ok(
        pending.body.services.some((service) => service._id === serviceId),
      );

      const approve = await adminClient.request(
        `/api/admin/services/${serviceId}/approve`,
        { method: "PATCH" },
      );

      assert.equal(approve.status, 200);
    });

    it("publishes the approved service", async () => {
      const detail = await customerClient.request(`/api/services/${serviceId}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.service.approvalStatus, "approved");

      const list = await customerClient.request("/api/services");
      assert.ok(
        list.body.services.some((service) => service._id === serviceId),
      );
    });

    it("resets approval when the owner updates the service", async () => {
      const update = await tech1Client.request(`/api/services/${serviceId}`, {
        method: "PATCH",
        body: { basePrice: 65 },
      });

      assert.equal(update.status, 200);
      assert.equal(update.body.service.approvalStatus, "pending");

      const detail = await customerClient.request(`/api/services/${serviceId}`);
      assert.equal(detail.status, 404);
    });

    it("supports admin rejection and re-approval", async () => {
      const reject = await adminClient.request(
        `/api/admin/services/${serviceId}/reject`,
        { method: "PATCH" },
      );
      assert.equal(reject.status, 200);

      const hidden = await customerClient.request(`/api/services/${serviceId}`);
      assert.equal(hidden.status, 404);

      const approve = await adminClient.request(
        `/api/admin/services/${serviceId}/approve`,
        { method: "PATCH" },
      );
      assert.equal(approve.status, 200);

      const visible = await customerClient.request(`/api/services/${serviceId}`);
      assert.equal(visible.status, 200);
    });

    it("validates service input and object ids", async () => {
      const badPrice = await tech1Client.request("/api/services", {
        method: "POST",
        body: {
          title: "Bad price service",
          category: "Test",
          description: "This request has an invalid base price value.",
          basePrice: "55",
          estimatedDuration: "60 minutes",
          serviceMode: "On-site",
          serviceArea: "Dhaka",
        },
      });
      assert.equal(badPrice.status, 400);

      const missingTitle = await tech1Client.request("/api/services", {
        method: "POST",
        body: {
          category: "Test",
          description: "This request is missing a title.",
          basePrice: 10,
          estimatedDuration: "60 minutes",
          serviceMode: "On-site",
          serviceArea: "Dhaka",
        },
      });
      assert.equal(missingTitle.status, 400);

      const badId = await tech1Client.request("/api/services/not-an-id", {
        method: "PATCH",
        body: { basePrice: 20 },
      });
      assert.equal(badId.status, 400);

      const badApproval = await adminClient.request(
        "/api/admin/services/not-an-id/approve",
        { method: "PATCH" },
      );
      assert.equal(badApproval.status, 400);
    });

    it("deletes the service for its owner", async () => {
      const response = await tech1Client.request(`/api/services/${serviceId}`, {
        method: "DELETE",
      });

      assert.equal(response.status, 200);
      assert.equal(
        (await customerClient.request(`/api/services/${serviceId}`)).status,
        404,
      );
    });
  });

  describe("Booking management", () => {
    let bookingServiceId;
    let bookingId;
    let cancelledBookingId;
    let completedBookingAmount;

    it("creates a booking from an approved service", async () => {
      const service = await createApprovedService("Booking");
      bookingServiceId = service.serviceId;

      const response = await createBooking(customerClient, bookingServiceId);
      assert.equal(response.status, 201, JSON.stringify(response.body));
      bookingId = response.body.bookingId;
    });

    it("prevents duplicate active bookings", async () => {
      const response = await createBooking(customerClient, bookingServiceId);
      assert.equal(response.status, 409);
    });

    it("prevents technicians from creating bookings", async () => {
      const response = await createBooking(tech1Client, bookingServiceId);
      assert.equal(response.status, 403);
    });

    it("lists bookings only for the owning customer", async () => {
      const response = await customerClient.request("/api/bookings/customer");

      assert.equal(response.status, 200);
      assert.ok(
        response.body.bookings.some((booking) => booking._id === bookingId),
      );
    });

    it("lists bookings only for the assigned technician", async () => {
      const response = await tech1Client.request("/api/bookings/technician");

      assert.equal(response.status, 200);
      assert.ok(
        response.body.bookings.some((booking) => booking._id === bookingId),
      );
    });

    it("protects booking details from other customers", async () => {
      otherCustomerEmail = `other-${suffix}@fixmate.test`;
      const signup = await signUp(otherCustomerClient, {
        name: "Other Customer",
        email: otherCustomerEmail,
        password: testPassword,
        role: "customer",
      });

      assert.equal(signup.status, 200, JSON.stringify(signup.body));
      otherCustomerId = signup.body.user.id;

      const response = await otherCustomerClient.request(
        `/api/bookings/${bookingId}`,
      );
      assert.equal(response.status, 403);
    });

    it("allows an admin to view any booking", async () => {
      const response = await adminClient.request(`/api/bookings/${bookingId}`);
      assert.equal(response.status, 200);
    });

    it("prevents another technician from updating the booking", async () => {
      const response = await tech2Client.request(
        `/api/bookings/${bookingId}/status`,
        {
          method: "PATCH",
          body: { status: "accepted" },
        },
      );

      assert.equal(response.status, 403);
    });

    it("enforces booking status transitions and final amount completion", async () => {
      const accept = await tech1Client.request(
        `/api/bookings/${bookingId}/status`,
        {
          method: "PATCH",
          body: { status: "accepted" },
        },
      );
      assert.equal(accept.status, 200);

      const cancelAccepted = await customerClient.request(
        `/api/bookings/${bookingId}/cancel`,
        { method: "PATCH" },
      );
      assert.equal(cancelAccepted.status, 400);

      const start = await tech1Client.request(
        `/api/bookings/${bookingId}/status`,
        {
          method: "PATCH",
          body: { status: "in-progress" },
        },
      );
      assert.equal(start.status, 200);

      const genericComplete = await tech1Client.request(
        `/api/bookings/${bookingId}/status`,
        {
          method: "PATCH",
          body: { status: "completed" },
        },
      );
      assert.equal(genericComplete.status, 400);

      const stringAmount = await tech1Client.request(
        `/api/bookings/${bookingId}/final-amount`,
        {
          method: "PATCH",
          body: { finalAmount: "90" },
        },
      );
      assert.equal(stringAmount.status, 400);

      const zeroAmount = await tech1Client.request(
        `/api/bookings/${bookingId}/final-amount`,
        {
          method: "PATCH",
          body: { finalAmount: 0 },
        },
      );
      assert.equal(zeroAmount.status, 400);

      completedBookingAmount = 90;

      const complete = await tech1Client.request(
        `/api/bookings/${bookingId}/final-amount`,
        {
          method: "PATCH",
          body: { finalAmount: completedBookingAmount },
        },
      );
      assert.equal(complete.status, 200);
      assert.equal(complete.body.booking.status, "completed");

      const cancelCompleted = await customerClient.request(
        `/api/bookings/${bookingId}/cancel`,
        { method: "PATCH" },
      );
      assert.equal(cancelCompleted.status, 400);
    });

    it("allows a customer to cancel a requested booking", async () => {
      const service = await createApprovedService("Cancellation");
      const created = await createBooking(customerClient, service.serviceId);
      assert.equal(created.status, 201);
      cancelledBookingId = created.body.bookingId;

      const cancel = await customerClient.request(
        `/api/bookings/${cancelledBookingId}/cancel`,
        { method: "PATCH" },
      );
      assert.equal(cancel.status, 200);

      const repeat = await customerClient.request(
        `/api/bookings/${cancelledBookingId}/cancel`,
        { method: "PATCH" },
      );
      assert.ok([400, 409].includes(repeat.status));
    });

    it("prevents customers from cancelling another customer's booking", async () => {
      const response = await otherCustomerClient.request(
        `/api/bookings/${bookingId}/cancel`,
        { method: "PATCH" },
      );
      assert.equal(response.status, 403);
    });

    it("rejects invalid booking input", async () => {
      const invalidService = await createBooking(customerClient, "not-an-id");
      assert.equal(invalidService.status, 400);

      const pendingService = await tech1Client.request("/api/services", {
        method: "POST",
        body: {
          title: `Pending Booking ${suffix}`,
          category: "Electronics",
          description: "A pending service that must not be bookable.",
          basePrice: 20,
          estimatedDuration: "30 minutes",
          serviceMode: "On-site",
          serviceArea: "Dhaka",
        },
      });
      assert.equal(pendingService.status, 201);

      const pendingBooking = await createBooking(
        customerClient,
        pendingService.body.serviceId,
      );
      assert.equal(pendingBooking.status, 400);

      const pastDateBooking = await createBooking(
        customerClient,
        bookingServiceId,
        {
          preferredDate: pastDate(),
          problemDescription: "This booking uses a date in the past.",
        },
      );
      assert.equal(pastDateBooking.status, 400);

      const missingAddress = await createBooking(
        customerClient,
        bookingServiceId,
        {
          address: "",
          problemDescription: "This booking is missing an address.",
        },
      );
      assert.equal(missingAddress.status, 400);
    });

    it("lets an admin list all bookings", async () => {
      const response = await adminClient.request("/api/admin/bookings");

      assert.equal(response.status, 200);
      assert.ok(
        response.body.bookings.some((booking) => booking._id === bookingId),
      );
    });

    it("stores completed booking data for payment tests", () => {
      assert.ok(bookingId);
      assert.ok(cancelledBookingId);
      assert.equal(completedBookingAmount, 90);
    });
  });

  describe("Admin management", () => {
    it("lists users and supports role filters", async () => {
      const response = await adminClient.request(
        "/api/admin/users?role=technician",
      );

      assert.equal(response.status, 200);
      assert.ok(response.body.users.length >= 2);
      assert.ok(
        response.body.users.every((user) => user.role === "technician"),
      );
    });

    it("returns user details", async () => {
      const response = await adminClient.request(
        `/api/admin/users/${newCustomerId}`,
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.user.email, newCustomerEmail);
    });

    it("updates a user role and rejects invalid roles", async () => {
      const promote = await adminClient.request(
        `/api/admin/users/${newCustomerId}/role`,
        {
          method: "PATCH",
          body: { role: "technician" },
        },
      );
      assert.equal(promote.status, 200);
      assert.equal(promote.body.user.role, "technician");

      const demote = await adminClient.request(
        `/api/admin/users/${newCustomerId}/role`,
        {
          method: "PATCH",
          body: { role: "customer" },
        },
      );
      assert.equal(demote.status, 200);
      assert.equal(demote.body.user.role, "customer");

      const invalid = await adminClient.request(
        `/api/admin/users/${newCustomerId}/role`,
        {
          method: "PATCH",
          body: { role: "super-admin" },
        },
      );
      assert.equal(invalid.status, 400);
    });

    it("prevents an admin from changing their own role", async () => {
      const profile = await adminClient.request("/api/profile");
      assert.equal(profile.status, 200);

      const response = await adminClient.request(
        `/api/admin/users/${profile.body.user._id}/role`,
        {
          method: "PATCH",
          body: { role: "customer" },
        },
      );

      assert.equal(response.status, 400);
    });

    it("returns dashboard statistics", async () => {
      const response = await adminClient.request("/api/admin/stats");

      assert.equal(response.status, 200);
      assert.equal(typeof response.body.stats.totalUsers, "number");
      assert.equal(typeof response.body.stats.totalCustomers, "number");
      assert.equal(typeof response.body.stats.totalTechnicians, "number");
      assert.equal(typeof response.body.stats.totalServices, "number");
      assert.equal(typeof response.body.stats.pendingServices, "number");
      assert.equal(typeof response.body.stats.approvedServices, "number");
      assert.equal(typeof response.body.stats.totalBookings, "number");
      assert.equal(typeof response.body.stats.completedBookings, "number");
      assert.equal(typeof response.body.stats.totalPayments, "number");
      assert.equal(typeof response.body.stats.totalRevenue, "number");
    });

    it("returns admin service, booking and payment lists", async () => {
      assert.equal(
        (await adminClient.request("/api/admin/services")).status,
        200,
      );
      assert.equal(
        (await adminClient.request("/api/admin/bookings")).status,
        200,
      );
      assert.equal(
        (await adminClient.request("/api/admin/payments")).status,
        200,
      );
    });
  });

  describe("Profile management", () => {
    it("returns the authenticated profile", async () => {
      const response = await customerClient.request("/api/profile");

      assert.equal(response.status, 200);
      assert.equal(response.body.user.role, "customer");
    });

    it("updates allowed profile fields without changing role", async () => {
      const response = await customerClient.request("/api/profile", {
        method: "PATCH",
        body: {
          name: "Updated Customer",
          phone: "+8801812345678",
          area: "Gulshan",
          bio: "Updated by the automated profile test.",
          role: "admin",
        },
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.user.name, "Updated Customer");
      assert.equal(response.body.user.role, "customer");
    });

    it("validates profile input", async () => {
      const badPhone = await customerClient.request("/api/profile", {
        method: "PATCH",
        body: { phone: "abc" },
      });
      assert.equal(badPhone.status, 400);

      const badImage = await customerClient.request("/api/profile", {
        method: "PATCH",
        body: { image: "javascript:alert(1)" },
      });
      assert.equal(badImage.status, 400);

      const empty = await customerClient.request("/api/profile", {
        method: "PATCH",
        body: {},
      });
      assert.equal(empty.status, 400);
    });

    it("rejects non-image uploads", async () => {
      const form = new FormData();
      form.append(
        "image",
        new Blob(["not an image"], { type: "text/plain" }),
        "note.txt",
      );

      const response = await customerClient.request("/api/profile/image", {
        method: "PATCH",
        body: form,
      });

      assert.equal(response.status, 400);
    });

    it("returns a configuration error when ImgBB is unavailable", async (t) => {
      if (process.env.IMGBB_API_KEY) {
        t.skip("IMGBB_API_KEY is configured; live upload test is opt-in.");
        return;
      }

      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2S8AAAAASUVORK5CYII=",
        "base64",
      );
      const form = new FormData();
      form.append("image", new Blob([png], { type: "image/png" }), "test.png");

      const response = await customerClient.request("/api/profile/image", {
        method: "PATCH",
        body: form,
      });

      assert.equal(response.status, 503);
    });
  });

  describe("Payment management", () => {
    let completedBookingId;
    let completedBookingAmount = 90;
    let secondCompletedBookingId;

    it("uses the completed booking from the booking lifecycle", async () => {
      const booking = await getDB()
        .collection("bookings")
        .findOne({
          customerEmail: "customer@fixmate.local",
          status: "completed",
          serviceTitle: `Automated Booking ${suffix}`,
        });

      assert.ok(booking);
      completedBookingId = booking._id.toString();
      completedBookingAmount = booking.finalAmount;
    });

    it("rejects checkout for non-customers and invalid bookings", async () => {
      assert.equal(
        (
          await tech1Client.request("/api/payments/checkout", {
            method: "POST",
            body: { bookingId: completedBookingId },
          })
        ).status,
        403,
      );

      assert.equal(
        (
          await otherCustomerClient.request("/api/payments/checkout", {
            method: "POST",
            body: { bookingId: completedBookingId },
          })
        ).status,
        403,
      );

      assert.equal(
        (
          await customerClient.request("/api/payments/checkout", {
            method: "POST",
            body: { bookingId: "not-an-id" },
          })
        ).status,
        400,
      );
    });

    it("rejects checkout for a booking that is not completed", async () => {
      const service = await createApprovedService("Checkout Pending");
      const booking = await createBooking(customerClient, service.serviceId);

      const response = await customerClient.request("/api/payments/checkout", {
        method: "POST",
        body: { bookingId: booking.body.bookingId },
      });

      assert.equal(response.status, 400);
    });

    it("returns a clear checkout failure when Stripe cannot be reached", async () => {
      const response = await customerClient.request("/api/payments/checkout", {
        method: "POST",
        body: { bookingId: completedBookingId },
      });

      if (process.env.RUN_STRIPE_LIVE_TESTS === "true") {
        assert.equal(response.status, 200);
        assert.ok(response.body.checkoutUrl);
      } else {
        assert.ok([502, 503].includes(response.status));
        assert.match(response.body.message, /Stripe/i);
      }
    });

    it("validates payment verification input", async () => {
      const missing = await customerClient.request("/api/payments/verify", {
        method: "POST",
        body: {},
      });
      assert.equal(missing.status, 400);

      const forbidden = await tech1Client.request("/api/payments/verify", {
        method: "POST",
        body: { sessionId: "cs_test" },
      });
      assert.equal(forbidden.status, 403);
    });

    it("records a signed Stripe webhook idempotently", async () => {
      const event = buildSessionEvent({
        bookingId: completedBookingId,
        amount: completedBookingAmount,
        sessionId: `cs_paid_${suffix}`,
      });

      const first = await sendWebhook(event);
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.equal(first.body.ignored, false);
      assert.equal(first.body.payment.bookingId, completedBookingId);

      const second = await sendWebhook(event);
      assert.equal(second.status, 200, JSON.stringify(second.body));
      assert.equal(second.body.alreadyProcessed, true);

      const differentSession = await sendWebhook(
        buildSessionEvent({
          bookingId: completedBookingId,
          amount: completedBookingAmount,
          sessionId: `cs_other_${suffix}`,
        }),
      );
      assert.equal(differentSession.status, 200);
      assert.equal(differentSession.body.ignored, true);

      const count = await getDB()
        .collection("payments")
        .countDocuments({ bookingId: completedBookingId });
      assert.equal(count, 1);
    });

    it("marks the booking as paid and exposes payment history", async () => {
      const booking = await customerClient.request(
        `/api/bookings/${completedBookingId}`,
      );
      assert.equal(booking.status, 200);
      assert.equal(booking.body.booking.paymentStatus, "paid");

      const history = await customerClient.request("/api/payments/history");
      assert.equal(history.status, 200);
      assert.ok(
        history.body.payments.some(
          (payment) => payment.bookingId === completedBookingId,
        ),
      );
    });

    it("protects payment details by booking ownership", async () => {
      assert.equal(
        (
          await customerClient.request(
            `/api/payments/booking/${completedBookingId}`,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await otherCustomerClient.request(
            `/api/payments/booking/${completedBookingId}`,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await adminClient.request(
            `/api/payments/booking/${completedBookingId}`,
          )
        ).status,
        200,
      );
    });

    it("rejects invalid webhook signatures", async () => {
      const event = buildSessionEvent({
        bookingId: completedBookingId,
        amount: completedBookingAmount,
      });

      const response = await sendWebhook(event, {
        signature: "invalid-signature",
      });

      assert.equal(response.status, 400);
    });

    it("ignores unsupported webhook events", async () => {
      const event = buildSessionEvent({
        bookingId: completedBookingId,
        amount: completedBookingAmount,
        type: "payment_intent.created",
      });

      const response = await sendWebhook(event);
      assert.equal(response.status, 200);
      assert.equal(response.body.ignored, true);
    });

    it("validates webhook amount, currency and customer email", async () => {
      const service = await createApprovedService("Webhook Validation");
      const booking = await createBooking(customerClient, service.serviceId);
      secondCompletedBookingId = booking.body.bookingId;
      await completeBooking(secondCompletedBookingId, 70);

      const wrongAmount = await sendWebhook(
        buildSessionEvent({
          bookingId: secondCompletedBookingId,
          amount: 100,
          sessionId: `cs_wrong_amount_${suffix}`,
        }),
      );
      assert.equal(wrongAmount.status, 200);
      assert.equal(wrongAmount.body.ignored, true);

      const wrongCurrency = await sendWebhook(
        buildSessionEvent({
          bookingId: secondCompletedBookingId,
          amount: 70,
          currency: "eur",
          sessionId: `cs_wrong_currency_${suffix}`,
        }),
      );
      assert.equal(wrongCurrency.status, 200);
      assert.equal(wrongCurrency.body.ignored, true);

      const wrongEmail = await sendWebhook(
        buildSessionEvent({
          bookingId: secondCompletedBookingId,
          amount: 70,
          email: "wrong@fixmate.test",
          sessionId: `cs_wrong_email_${suffix}`,
        }),
      );
      assert.equal(wrongEmail.status, 200);
      assert.equal(wrongEmail.body.ignored, true);

      const countBefore = await getDB()
        .collection("payments")
        .countDocuments({ bookingId: secondCompletedBookingId });
      assert.equal(countBefore, 0);

      const valid = await sendWebhook(
        buildSessionEvent({
          bookingId: secondCompletedBookingId,
          amount: 70,
          sessionId: `cs_valid_${suffix}`,
        }),
      );
      assert.equal(valid.status, 200);
      assert.equal(valid.body.ignored, false);
    });

    it("ignores webhooks for unpaid or non-completed bookings", async () => {
      const service = await createApprovedService("Webhook State");
      const booking = await createBooking(customerClient, service.serviceId);

      const response = await sendWebhook(
        buildSessionEvent({
          bookingId: booking.body.bookingId,
          amount: 55,
          sessionId: `cs_not_completed_${suffix}`,
        }),
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.ignored, true);
    });

    it("returns admin payment history and updated statistics", async () => {
      const payments = await adminClient.request("/api/admin/payments");
      assert.equal(payments.status, 200);
      assert.ok(payments.body.payments.length >= 2);

      const stats = await adminClient.request("/api/admin/stats");
      assert.equal(stats.status, 200);
      assert.ok(stats.body.stats.totalPayments >= 2);
      assert.ok(stats.body.stats.totalRevenue >= 160);
    });
  });
});
