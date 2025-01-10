import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import xlsx from "xlsx";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import dotenv from 'dotenv';
dotenv.config();
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // Serve static files

// MongoDB connection
mongoose.connect(process.env.MONGODBURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("MongoDB connected successfully");
}).catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
});
// Schema for Instagram Data
const DataSchema = new mongoose.Schema(
    [{
        instagram_id: { type: String },
        username: { type: String },
        full_name: { type: String },
        profile_link: { type: String },
        avatar_pic: { type: String },
        followed_by_viewer: { type: Boolean },
        is_verified: { type: Boolean },
        followers_count: { type: Number },
        following_count: { type: Number },
        biography: { type: String },
        public_email: { type: String },
        posts_count: { type: Number },
        phone_country_code: { type: String },
        phone_number: { type: String },
        city: { type: String },
        address: { type: String },
        is_private: { type: Boolean },
        is_business: { type: Boolean },
        external_url: { type: String },
    }],
    { timestamps: true }
);

const DataModel = mongoose.model("InstagramData", DataSchema);

// Multer setup for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath); // Create folder if not exists
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Route: Upload Excel File
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("No file uploaded");
        }

        // Check if the uploaded file is an Excel file
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (ext !== '.xlsx') {
            return res.status(400).send("Invalid file format. Please upload an Excel file.");
        }

        // Parse Excel file
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Log the parsed data for debugging
        console.log("Parsed Data:", sheetData);

        // Map and format data to match the MongoDB schema
        const mappedData = sheetData.map(item => ({
            instagram_id: item['Instagram ID'],
            username: item['Username'],
            full_name: item['Full name'],
            profile_link: item['Profile link'],
            avatar_pic: item['Avatar pic'],
            followed_by_viewer: item['Followed by viewer'] === 'Yes',  // Convert to boolean
            is_verified: item['Is verified'] === 'Yes',  // Convert to boolean
            followers_count: item['Followers count'],
            following_count: item['Following count'],
            biography: item['Biography'],
            public_email: item['Public email'],
            posts_count: item['Posts count'],
            phone_country_code: item['Phone country code'],
            phone_number: item['Phone number'],
            city: item['City'],
            address: item['Address'],
            is_private: item['Is private'] === 'YES',  // Convert to boolean
            is_business: item['Is business'] === 'YES',  // Convert to boolean
            external_url: item['External url']
        }));

        // Insert mapped data into MongoDB
        const result = await DataModel.insertMany(mappedData);
        console.log("MongoDB Insert Result:", result);

        res.status(200).send("File uploaded and data saved successfully!");
    } catch (error) {
        console.error("Error during upload:", error);
        res.status(500).send("An error occurred");
    }
});

// Serve HTML Upload Form
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
