import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../config/auth.js";
import { getDB } from "../config/db.js";

const getRoleFromDatabase = async (email) => {
  if (!email) {
    return null;
  }

  const user = await getDB()
    .collection("user")
    .findOne({ email }, { projection: { role: 1 } });

  return user?.role || null;
};

// 1. Authenticate User
export const authenticate = async (req, res, next) => {
  try {
    const auth = getAuth();

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login first.",
      });
    }

    const role = session.user.role || (await getRoleFromDatabase(session.user.email));

    // Attach authenticated user to request
    req.user = {
      ...session.user,
      role,
    };
    req.session = session.session;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired session",
    });
  }
};

// 2. Authorize User Roles
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }

    next();
  };
};
