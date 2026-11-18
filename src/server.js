import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

const app = express();
const PORT = process.env.PORT || 5000;

//middleware

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to the FixMate API" });
});

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server Startup Failed:", error.message);
  }
};

startServer();