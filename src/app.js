import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import { getDB } from "./config/db.js";
import { getTrustedOrigins } from "./config/origins.js";

import serviceRoutes from "./routes/service.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import profileRoutes from "./routes/profile.routes.js";

import { stripeWebhookController } from "./controllers/payment.controller.js";
import {
  notFoundHandler,
  errorHandler,
} from "./middleware/error.middleware.js";

const createCorsOptions = () => {
  const trustedOrigins = getTrustedOrigins();

  return {
    origin: (origin, callback) => {
      if (!origin || trustedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "stripe-signature",
    ],
  };
};

export const createApp = (auth) => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(cors(createCorsOptions()));

  // BetterAuth must receive the raw request before Express body parsing.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  // Stripe webhooks need the raw body for signature verification.
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhookController,
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use("/api/services", serviceRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/profile", profileRoutes);

  app.get("/api/health", async (req, res) => {
    try {
      await getDB().command({ ping: 1 });

      res.status(200).json({
        success: true,
        status: "ok",
        message: "FixMate API is healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        success: false,
        status: "unavailable",
        message: "Database connection is unavailable",
      });
    }
  });

  app.get("/", (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome to the FixMate API",
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
