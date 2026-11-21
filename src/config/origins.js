const DEFAULT_FRONTEND_URL = "http://localhost:3000";

export const getTrustedOrigins = () => {
  const rawValues = [
    process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL,
    process.env.CORS_ORIGINS || "",
  ]
    .filter(Boolean)
    .join(",");

  return [
    ...new Set(
      rawValues
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ];
};

export const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
};
