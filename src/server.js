
import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import connectDB from "./config/db.js";
import { initializeAuth } from "./config/auth.js";

import serviceRoutes from "./routes/service.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Start Server
const startServer = async () => {
  try {
    // Connect MongoDB
    await connectDB();

    // Initialize BetterAuth
    const auth = initializeAuth();

    // BetterAuth Handler (Express 5)
    app.all("/api/auth/*splat", toNodeHandler(auth));

    // JSON Middleware
    app.use(express.json());

    // API Routes
    app.use("/api/services", serviceRoutes);
    app.use("/api/bookings", bookingRoutes);
    app.use("/api/payments", paymentRoutes);

    // Health Check
    app.get("/", (req, res) => {
      res.status(200).json({
        message: "Welcome to the FixMate API",
      });
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server Startup Failed:", error.message);
    process.exit(1);
  }
};

startServer();
