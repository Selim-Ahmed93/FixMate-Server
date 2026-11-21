import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";

import { getDB } from "./db.js";
import { getTrustedOrigins } from "./origins.js";
import { normalizeRole } from "../utils/validate.js";

let auth;

const getProductionCookieOptions = () => {
  if (process.env.NODE_ENV !== "production") {
    return undefined;
  }

  return {
    useSecureCookies: true,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    },
  };
};

export const initializeAuth = () => {
  if (auth) {
    return auth;
  }

  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET environment variable is required");
  }

  auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: getTrustedOrigins(),
    database: mongodbAdapter(getDB()),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },

    user: {
      additionalFields: {
        role: {
          type: ["customer", "technician"],
          required: false,
          defaultValue: "customer",
          input: true,
        },

        phone: {
          type: "string",
          required: false,
          input: true,
        },

        area: {
          type: "string",
          required: false,
          input: true,
        },

        bio: {
          type: "string",
          required: false,
          input: true,
        },
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (userData) => {
            return {
              data: {
                ...userData,
                role: normalizeRole(userData.role),
              },
            };
          },
        },
        update: {
          before: async (userData) => {
            const { role, ...safeData } = userData;

            return {
              data: safeData,
            };
          },
        },
      },
    },

    advanced: getProductionCookieOptions(),
  });

  return auth;
};

export const getAuth = () => {
  if (!auth) {
    throw new Error("BetterAuth is not initialized");
  }

  return auth;
};
