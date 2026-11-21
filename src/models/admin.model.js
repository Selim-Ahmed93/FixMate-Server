import { getDB } from "../config/db.js";

export const getDashboardStats = async () => {
  const db = getDB();
  const users = db.collection("user");
  const services = db.collection("services");
  const bookings = db.collection("bookings");
  const payments = db.collection("payments");

  const [
    totalUsers,
    totalCustomers,
    totalTechnicians,
    totalAdmins,
    totalServices,
    pendingServices,
    approvedServices,
    totalBookings,
    completedBookings,
    totalPayments,
    revenueResult,
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ role: "customer" }),
    users.countDocuments({ role: "technician" }),
    users.countDocuments({ role: "admin" }),
    services.countDocuments(),
    services.countDocuments({ approvalStatus: "pending" }),
    services.countDocuments({ approvalStatus: "approved" }),
    bookings.countDocuments(),
    bookings.countDocuments({ status: "completed" }),
    payments.countDocuments({ paymentStatus: "paid" }),
    payments
      .aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .toArray(),
  ]);

  return {
    totalUsers,
    totalCustomers,
    totalTechnicians,
    totalAdmins,
    totalServices,
    pendingServices,
    approvedServices,
    totalBookings,
    completedBookings,
    totalPayments,
    totalRevenue: revenueResult[0]?.total || 0,
  };
};
