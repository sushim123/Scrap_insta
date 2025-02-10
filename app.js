import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import xlsx from "xlsx";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Schema to store Instagram data
const instagramDataSchema = new mongoose.Schema(
  {
    instagram_id: { type: String },
    username: { type: String, unique: true }, // Enforce unique index
    full_name: { type: String },
    profile_link: { type: String },
    avatar_pic: { type: String },
    followed_by_viewer: {
      type: Boolean,
      set: (value) => value === "Yes",
    },
    is_verified: {
      type: Boolean,
      set: (value) => value === "Yes",
    },
    followers_count: { type: Number },
    following_count: { type: Number },
    biography: { type: String },
    public_email: { type: String },
    posts_count: { type: Number },
    phone_country_code: { type: String },
    phone_number: { type: String },
    city: { type: String },
    address: { type: String },
    is_private: {
      type: Boolean,
      set: (value) => value === "Yes",
    },
    is_business: {
      type: Boolean,
      set: (value) => value === "Yes",
    },
    external_url: { type: String },
  },
  { timestamps: true }
);

const InstagramData = mongoose.model("InstagramData", instagramDataSchema);

// Middleware to serve static files (HTML form)
app.use(express.static("public"));

// Multer setup for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath); // Create uploads folder if it doesn't exist
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Function to convert string "YES"/"NO" to boolean true/false
const convertToBoolean = (value) => {
  if (value === "YES") return true;
  if (value === "NO") return false;
  return value; // Return the original value if it's not "YES" or "NO"
};
app.get("/api/data", async (req, res) => {
  try {
    const data = await InstagramData.find({});
    res.status(200).json(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/data/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const users = await InstagramData.find({
      username: { $regex: username, $options: "i" },
    });
    if (users.length === 0) {
      return res.json({ message: "no match found " });
    }
   

    res.status(200).json(users);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

// File upload route
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }

  const filePath = req.file.path;

  // Read and parse the Excel file
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Get the first sheet
  const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Log parsed data (for debugging)
  console.log("Parsed Excel Data:", sheetData);

  // Map the parsed data to MongoDB schema
  const mappedData = sheetData.map((item) => ({
    instagram_id: item["Instagram ID"],
    username: item["Username"],
    full_name: item["Full name"],
    profile_link: item["Profile link"],
    avatar_pic: item["Avatar pic"],
    followed_by_viewer: convertToBoolean(item["Followed by viewer"]),
    is_verified: convertToBoolean(item["Is verified"]),
    followers_count: item["Followers count"],
    following_count: item["Following count"],
    biography: item["Biography"],
    public_email: item["Public email"],
    posts_count: item["Posts count"],
    phone_country_code: item["Phone country code"],
    phone_number: item["Phone number"],
    city: item["City"],
    address: item["Address"],
    is_private: convertToBoolean(item["Is private"]),
    is_business: convertToBoolean(item["Is business"]),
    external_url: item["External url"],
  }));

  // Log the mapped data before saving
  console.log("Mapped Data:", mappedData);

  try {
    // Fetch all existing usernames from the database
    const existingUsernames = new Set(
      (await InstagramData.find({}, { username: 1, _id: 0 }).lean()).map(
        (doc) => doc.username
      )
    );

    // Filter out duplicates
    const filteredData = mappedData.filter(
      (item) => !existingUsernames.has(item.username)
    );

    if (filteredData.length === 0) {
      return res.status(200).json({
        message: "No new data to insert. All records are duplicates.",
      });
    }

    // Save filtered data to MongoDB
    const savedData = await InstagramData.insertMany(filteredData);
    res.status(200).json({
      message: "File uploaded and unique data saved to database",
      data: savedData,
    });
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Error saving data to database");
  }
});

// Serve the HTML upload form
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
