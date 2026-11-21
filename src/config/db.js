import { MongoClient } from "mongodb";
import createIndexes from "./indexes.js";

let client;
let database;

const connectDB = async () => {
  if (database) {
    return database;
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME;

  if (!uri || !dbName) {
    throw new Error("MONGODB_URI and DB_NAME environment variables are required");
  }

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    database = client.db(dbName);

    await createIndexes(database);

    const collections = ["services", "bookings", "payments"];
    const existingCollections = await database.listCollections().toArray();
    const existingNames = existingCollections.map((collection) => collection.name);

    for (const collection of collections) {
      if (!existingNames.includes(collection)) {
        await database.createCollection(collection);
        console.log(`${collection} collection created`);
      }
    }

    console.log("MongoDB Connected Successfully!");
    return database;
  } catch (error) {
    database = undefined;

    if (client) {
      await client.close().catch(() => {});
      client = undefined;
    }

    throw error;
  }
};

export default connectDB;

export const getDB = () => {
  if (!database) {
    throw new Error("Database is not connected!");
  }

  return database;
};

export const closeDB = async () => {
  if (client) {
    await client.close();
    client = undefined;
  }

  database = undefined;
};
