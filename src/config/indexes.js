const createIndexes = async (database) => {
  try {
    // Services indexes
    await database.collection("services").createIndexes([
      { key: { technicianEmail: 1 } },
      { key: { approvalStatus: 1 } },
    ]);

    // Bookings indexes
    await database.collection("bookings").createIndexes([
      { key: { customerEmail: 1 } },
      { key: { technicianEmail: 1 } },
      { key: { serviceId: 1 } },
    ]);

    // Payments indexes
    await database.collection("payments").createIndexes([
      { key: { bookingId: 1 }, unique: true },
      { key: { stripeSessionId: 1 }, unique: true },
    ]);

    console.log("Database Indexes Created Successfully!");
  } catch (error) {
    console.error("Database Index Creation Failed:", error.message);
    throw error;
  }
};

export default createIndexes;