
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";

import { getDB } from "./db.js";

let auth;

export const initializeAuth = () => {
  auth = betterAuth({
    database: mongodbAdapter(getDB()),

    emailAndPassword: {
      enabled: true,
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
  });

  return auth;
};

export const getAuth = () => {
  if (!auth) {
    throw new Error("BetterAuth is not initialized");
  }

  return auth;
};