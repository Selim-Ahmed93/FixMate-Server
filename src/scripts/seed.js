import "dotenv/config";

import connectDB, { closeDB } from "../config/db.js";
import { initializeAuth } from "../config/auth.js";
import { seedSampleData } from "./seed.helpers.js";

const run = async () => {
  try {
    await connectDB();
    initializeAuth();

    const counts = await seedSampleData();

    console.log(
      `Seed complete: ${counts.serviceCount} services, ${counts.bookingCount} bookings, ${counts.paymentCount} payments, 2 technicians, 1 customer.`,
    );
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
};

run();
