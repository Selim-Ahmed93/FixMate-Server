import "dotenv/config";

import connectDB, { closeDB } from "../config/db.js";
import { initializeAuth } from "../config/auth.js";
import { seedAdminUser } from "./seed.helpers.js";

const run = async () => {
  try {
    await connectDB();
    initializeAuth();

    await seedAdminUser();

    console.log("Admin account is ready.");
  } catch (error) {
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
};

run();
