const createIndexSafely = async (collection, keys, options = {}) => {
  try {
    await collection.createIndex(keys, options);
  } catch (error) {
    const isDuplicateDataError =
      error?.code === 11000 ||
      error?.codeName === "DuplicateKey" ||
      /duplicate key/i.test(error?.message || "");

    if (isDuplicateDataError) {
      console.warn(
        `Skipped index ${options.name || JSON.stringify(keys)} because existing duplicate data was found.`,
      );
      return;
    }

    throw error;
  }
};

const createIndexes = async (database) => {
  // BetterAuth user collection
  await createIndexSafely(
    database.collection("user"),
    { role: 1 },
    { name: "user_role" },
  );

  // Services
  await createIndexSafely(
    database.collection("services"),
    { technicianEmail: 1 },
    { name: "services_technician_email" },
  );
  await createIndexSafely(
    database.collection("services"),
    { approvalStatus: 1 },
    { name: "services_approval_status" },
  );
  await createIndexSafely(
    database.collection("services"),
    { approvalStatus: 1, isAvailable: 1 },
    { name: "services_public_listing" },
  );
  await createIndexSafely(
    database.collection("services"),
    { createdAt: -1 },
    { name: "services_created_at" },
  );

  // Bookings
  await createIndexSafely(
    database.collection("bookings"),
    { customerEmail: 1 },
    { name: "bookings_customer_email" },
  );
  await createIndexSafely(
    database.collection("bookings"),
    { technicianEmail: 1 },
    { name: "bookings_technician_email" },
  );
  await createIndexSafely(
    database.collection("bookings"),
    { serviceId: 1 },
    { name: "bookings_service_id" },
  );
  await createIndexSafely(
    database.collection("bookings"),
    { status: 1 },
    { name: "bookings_status" },
  );
  await createIndexSafely(
    database.collection("bookings"),
    { customerEmail: 1, status: 1 },
    { name: "bookings_customer_status" },
  );
  await createIndexSafely(
    database.collection("bookings"),
    { technicianEmail: 1, status: 1 },
    { name: "bookings_technician_status" },
  );
  await createIndexSafely(
    database.collection("bookings"),
    { serviceId: 1, customerEmail: 1 },
    {
      name: "uniq_active_booking_per_service_customer",
      unique: true,
      partialFilterExpression: {
        status: { $in: ["requested", "accepted", "in-progress"] },
      },
    },
  );

  // Payments
  await createIndexSafely(
    database.collection("payments"),
    { bookingId: 1 },
    { name: "uniq_payment_booking", unique: true },
  );
  await createIndexSafely(
    database.collection("payments"),
    { stripeSessionId: 1 },
    { name: "uniq_payment_stripe_session", unique: true },
  );
  await createIndexSafely(
    database.collection("payments"),
    { customerEmail: 1 },
    { name: "payments_customer_email" },
  );
  await createIndexSafely(
    database.collection("payments"),
    { paidAt: -1 },
    { name: "payments_paid_at" },
  );

  console.log("Database Indexes Created Successfully!");
};

export default createIndexes;
