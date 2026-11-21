import "dotenv/config";
import { pathToFileURL } from "node:url";

import connectDB, { closeDB } from "./config/db.js";
import { initializeAuth } from "./config/auth.js";
import { createApp } from "./app.js";

const REQUIRED_ENV_VARIABLES = [
  "MONGODB_URI",
  "DB_NAME",
  "BETTER_AUTH_SECRET",
];

const validateEnvironment = () => {
  for (const variable of REQUIRED_ENV_VARIABLES) {
    if (!process.env[variable]) {
      throw new Error(`${variable} environment variable is required`);
    }
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.BETTER_AUTH_URL) {
      throw new Error("BETTER_AUTH_URL is required in production");
    }

    if (!process.env.FRONTEND_URL) {
      throw new Error("FRONTEND_URL is required in production");
    }
  }
};

export const startServer = async ({ port } = {}) => {
  validateEnvironment();

  await connectDB();

  const auth = initializeAuth();
  const app = createApp(auth);
  const resolvedPort = port ?? (Number(process.env.PORT) || 5000);

  return await new Promise((resolve, reject) => {
    const server = app.listen(resolvedPort, () => {
      console.log(`Server is running on port ${server.address().port}`);
      resolve(server);
    });

    server.on("error", reject);
  });
};

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  startServer()
    .then((server) => {
      const shutdown = async (signal) => {
        console.log(`${signal} received. Shutting down gracefully...`);

        server.close(async () => {
          await closeDB();
          process.exit(0);
        });
      };

      process.on("SIGINT", () => shutdown("SIGINT"));
      process.on("SIGTERM", () => shutdown("SIGTERM"));
    })
    .catch((error) => {
      console.error("Server startup failed:", error.message);
      process.exit(1);
    });
}
