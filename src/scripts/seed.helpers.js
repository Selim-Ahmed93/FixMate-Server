import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { getAuth } from "../config/auth.js";
import { AppError } from "../utils/errors.js";

const DEFAULT_ADMIN_EMAIL = "admin@fixmate.local";
const DEFAULT_ADMIN_NAME = "FixMate Admin";
const DEFAULT_TECHNICIAN_1_EMAIL = "technician1@fixmate.local";
const DEFAULT_TECHNICIAN_1_NAME = "Rahim Uddin";
const DEFAULT_TECHNICIAN_2_EMAIL = "technician2@fixmate.local";
const DEFAULT_TECHNICIAN_2_NAME = "Karim Hossain";
const DEFAULT_CUSTOMER_EMAIL = "customer@fixmate.local";
const DEFAULT_CUSTOMER_NAME = "Nusrat Jahan";

const ensureNotProduction = () => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEED_ALLOW_PRODUCTION !== "true"
  ) {
    throw new AppError(
      "Seeding is disabled in production. Set SEED_ALLOW_PRODUCTION=true only if you intentionally want to seed production.",
      400,
    );
  }
};

const requirePassword = (name) => {
  const value = process.env[name];

  if (!value || value.length < 8) {
    throw new AppError(
      `${name} must be set to a password of at least 8 characters`,
      400,
    );
  }

  return value;
};

export const ensureUser = async ({ name, email, password, role }) => {
  const users = getDB().collection("user");
  const normalizedEmail = email.toLowerCase();
  let user = await users.findOne({ email: normalizedEmail });

  if (!user) {
    await getAuth().api.signUpEmail({
      body: {
        name,
        email: normalizedEmail,
        password,
        role: role === "admin" ? "customer" : role,
      },
    });

    user = await users.findOne({ email: normalizedEmail });
  }

  if (!user) {
    throw new Error(`Could not create seed user ${normalizedEmail}`);
  }

  if (user.role !== role) {
    await users.updateOne(
      { _id: user._id },
      { $set: { role, updatedAt: new Date() } },
    );

    user.role = role;
  }

  return user;
};

export const ensureService = async (service) => {
  const services = getDB().collection("services");
  const existing = await services.findOne({
    title: service.title,
    technicianEmail: service.technicianEmail,
  });

  if (existing) {
    await services.updateOne(
      { _id: existing._id },
      {
        $set: {
          approvalStatus: "approved",
          isAvailable: true,
        },
      },
    );

    return existing._id;
  }

  const result = await services.insertOne({
    ...service,
    approvalStatus: "approved",
    isAvailable: true,
    createdAt: new Date(),
  });

  return result.insertedId;
};

export const ensureBooking = async (booking) => {
  const bookings = getDB().collection("bookings");
  const existing = await bookings.findOne({
    customerEmail: booking.customerEmail,
    serviceId: booking.serviceId.toString(),
    problemDescription: booking.problemDescription,
  });

  if (existing) {
    return existing._id;
  }

  const result = await bookings.insertOne({
    ...booking,
    serviceId: booking.serviceId.toString(),
  });

  return result.insertedId;
};

export const ensurePayment = async (payment) => {
  const payments = getDB().collection("payments");
  const bookings = getDB().collection("bookings");
  const bookingObjectId = new ObjectId(payment.bookingId);
  const existing = await payments.findOne({ bookingId: payment.bookingId });

  if (existing) {
    await bookings.updateOne(
      { _id: bookingObjectId },
      { $set: { paymentStatus: "paid" } },
    );

    return existing._id;
  }

  const result = await payments.insertOne(payment);

  await bookings.updateOne(
    { _id: bookingObjectId },
    { $set: { paymentStatus: "paid" } },
  );

  return result.insertedId;
};

const buildServices = (technician1, technician2) => {
  const commonImage = "https://placehold.co/600x400?text=FixMate+Service";

  return [
    {
      title: "Washing Machine Repair",
      category: "Appliance Repair",
      description:
        "Diagnosis and repair for front-load and top-load washing machines.",
      image: commonImage,
      basePrice: 45,
      estimatedDuration: "60 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician1.name,
      technicianEmail: technician1.email,
    },
    {
      title: "Refrigerator Repair",
      category: "Appliance Repair",
      description:
        "Cooling, compressor, thermostat, and drainage repair for refrigerators.",
      image: commonImage,
      basePrice: 60,
      estimatedDuration: "90 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician2.name,
      technicianEmail: technician2.email,
    },
    {
      title: "Air Conditioner Servicing",
      category: "HVAC",
      description:
        "AC cleaning, gas pressure checks, and seasonal maintenance.",
      image: commonImage,
      basePrice: 75,
      estimatedDuration: "120 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician1.name,
      technicianEmail: technician1.email,
    },
    {
      title: "Ceiling Fan Installation",
      category: "Electrical",
      description:
        "Safe installation and wiring of ceiling fans and regulators.",
      image: commonImage,
      basePrice: 30,
      estimatedDuration: "45 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician2.name,
      technicianEmail: technician2.email,
    },
    {
      title: "Kitchen Sink Leak Repair",
      category: "Plumbing",
      description:
        "Leak detection and repair for kitchen sinks, pipes, and fittings.",
      image: commonImage,
      basePrice: 40,
      estimatedDuration: "60 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician1.name,
      technicianEmail: technician1.email,
    },
    {
      title: "Microwave Oven Repair",
      category: "Electronics",
      description:
        "Repair for heating, turntable, control panel, and door switch issues.",
      image: commonImage,
      basePrice: 35,
      estimatedDuration: "50 minutes",
      serviceMode: "Workshop",
      serviceArea: "Dhaka",
      technicianName: technician2.name,
      technicianEmail: technician2.email,
    },
    {
      title: "Water Heater Repair",
      category: "Plumbing",
      description:
        "Inspection and repair of electric and gas water heating units.",
      image: commonImage,
      basePrice: 55,
      estimatedDuration: "90 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician1.name,
      technicianEmail: technician1.email,
    },
    {
      title: "Television Screen Repair",
      category: "Electronics",
      description:
        "Screen, backlight, and board-level repair for modern televisions.",
      image: commonImage,
      basePrice: 80,
      estimatedDuration: "120 minutes",
      serviceMode: "Workshop",
      serviceArea: "Dhaka",
      technicianName: technician2.name,
      technicianEmail: technician2.email,
    },
    {
      title: "Electrical Wiring Inspection",
      category: "Electrical",
      description:
        "Home wiring safety inspection, fault finding, and load checks.",
      image: commonImage,
      basePrice: 65,
      estimatedDuration: "90 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician1.name,
      technicianEmail: technician1.email,
    },
    {
      title: "Deep Cleaning Service",
      category: "Home Maintenance",
      description:
        "Room-by-room deep cleaning for kitchens, bathrooms, and living areas.",
      image: commonImage,
      basePrice: 50,
      estimatedDuration: "120 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician2.name,
      technicianEmail: technician2.email,
    },
    {
      title: "Door Lock Replacement",
      category: "Home Maintenance",
      description:
        "Replacement and fitting of secure door locks and handles.",
      image: commonImage,
      basePrice: 25,
      estimatedDuration: "45 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician1.name,
      technicianEmail: technician1.email,
    },
    {
      title: "Smart Home Device Setup",
      category: "Electronics",
      description:
        "Setup and configuration for smart bulbs, plugs, and home hubs.",
      image: commonImage,
      basePrice: 70,
      estimatedDuration: "90 minutes",
      serviceMode: "On-site",
      serviceArea: "Dhaka",
      technicianName: technician2.name,
      technicianEmail: technician2.email,
    },
  ];
};

export const seedAdminUser = async () => {
  ensureNotProduction();

  const password = requirePassword("ADMIN_PASSWORD");
  const email = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME || DEFAULT_ADMIN_NAME;

  const admin = await ensureUser({
    name,
    email,
    password,
    role: "admin",
  });

  return admin;
};

export const seedSampleData = async () => {
  ensureNotProduction();

  const adminPassword = requirePassword("ADMIN_PASSWORD");
  const seedPassword = requirePassword("SEED_PASSWORD");

  const admin = await ensureUser({
    name: process.env.ADMIN_NAME || DEFAULT_ADMIN_NAME,
    email: process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
    password: adminPassword,
    role: "admin",
  });

  const technician1 = await ensureUser({
    name: process.env.SEED_TECHNICIAN_1_NAME || DEFAULT_TECHNICIAN_1_NAME,
    email:
      process.env.SEED_TECHNICIAN_1_EMAIL || DEFAULT_TECHNICIAN_1_EMAIL,
    password: seedPassword,
    role: "technician",
  });

  const technician2 = await ensureUser({
    name: process.env.SEED_TECHNICIAN_2_NAME || DEFAULT_TECHNICIAN_2_NAME,
    email:
      process.env.SEED_TECHNICIAN_2_EMAIL || DEFAULT_TECHNICIAN_2_EMAIL,
    password: seedPassword,
    role: "technician",
  });

  const customer = await ensureUser({
    name: process.env.SEED_CUSTOMER_NAME || DEFAULT_CUSTOMER_NAME,
    email: process.env.SEED_CUSTOMER_EMAIL || DEFAULT_CUSTOMER_EMAIL,
    password: seedPassword,
    role: "customer",
  });

  const serviceDefinitions = buildServices(technician1, technician2);
  const serviceIds = [];

  for (const service of serviceDefinitions) {
    const serviceId = await ensureService(service);
    serviceIds.push(serviceId);
  }

  const day = 24 * 60 * 60 * 1000;
  const future = (days) => new Date(Date.now() + days * day);
  const past = (days) => new Date(Date.now() - days * day);

  const bookingDefinitions = [
    {
      serviceIndex: 0,
      status: "requested",
      preferredDate: future(3),
      problemDescription:
        "Washing machine stops suddenly during the spin cycle.",
      finalAmount: serviceDefinitions[0].basePrice,
      paymentStatus: "unpaid",
    },
    {
      serviceIndex: 1,
      status: "accepted",
      preferredDate: future(4),
      problemDescription:
        "Refrigerator is running but not cooling properly.",
      finalAmount: serviceDefinitions[1].basePrice,
      paymentStatus: "unpaid",
    },
    {
      serviceIndex: 2,
      status: "in-progress",
      preferredDate: future(1),
      problemDescription:
        "Air conditioner is making a loud rattling noise.",
      finalAmount: serviceDefinitions[2].basePrice,
      paymentStatus: "unpaid",
    },
    {
      serviceIndex: 3,
      status: "completed",
      preferredDate: past(10),
      problemDescription:
        "Ceiling fan installation completed and tested.",
      finalAmount: serviceDefinitions[3].basePrice + 10,
      paymentStatus: "unpaid",
    },
    {
      serviceIndex: 4,
      status: "completed",
      preferredDate: past(20),
      problemDescription:
        "Kitchen sink leak repaired and water flow checked.",
      finalAmount: serviceDefinitions[4].basePrice + 15,
      paymentStatus: "paid",
    },
    {
      serviceIndex: 5,
      status: "cancelled",
      preferredDate: past(5),
      problemDescription:
        "Microwave repair request cancelled by the customer.",
      finalAmount: serviceDefinitions[5].basePrice,
      paymentStatus: "unpaid",
    },
    {
      serviceIndex: 6,
      status: "rejected",
      preferredDate: past(7),
      problemDescription:
        "Water heater repair request rejected by the technician.",
      finalAmount: serviceDefinitions[6].basePrice,
      paymentStatus: "unpaid",
    },
  ];

  const bookingIds = [];

  for (const definition of bookingDefinitions) {
    const service = serviceDefinitions[definition.serviceIndex];
    const serviceId = serviceIds[definition.serviceIndex];

    const bookingId = await ensureBooking({
      serviceId,
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone || "+8801700000000",
      address: "House 12, Road 5, Dhanmondi, Dhaka",
      preferredDate: definition.preferredDate,
      problemDescription: definition.problemDescription,
      status: definition.status,
      finalAmount: definition.finalAmount,
      paymentStatus: definition.paymentStatus,
    });

    bookingIds.push({
      id: bookingId,
      definition,
      service,
    });
  }

  const paidBooking = bookingIds.find(
    (booking) => booking.definition.paymentStatus === "paid",
  );

  if (paidBooking) {
    await ensurePayment({
      bookingId: paidBooking.id.toString(),
      serviceTitle: paidBooking.service.title,
      customerName: customer.name,
      customerEmail: customer.email,
      technicianName: paidBooking.service.technicianName,
      technicianEmail: paidBooking.service.technicianEmail,
      amount: paidBooking.definition.finalAmount,
      currency: "usd",
      transactionId: "seed_txn_001",
      stripeSessionId: "seed_cs_001",
      paymentStatus: "paid",
      paidAt: past(20),
    });
  }

  return {
    adminId: admin._id,
    technicianCount: 2,
    customerCount: 1,
    serviceCount: serviceIds.length,
    bookingCount: bookingIds.length,
    paymentCount: paidBooking ? 1 : 0,
  };
};
