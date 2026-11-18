import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

const client = new MongoClient(uri);

let database;

const connectDB = async () => {
  try {
    await client.connect();

    database = client.db(dbName);

    console.log("MongoDB Connected Successfully!");

    return database;
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;