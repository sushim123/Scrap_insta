import multer from 'multer';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB Schema
const instagramDataSchema = new mongoose.Schema({
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
}, { timestamps: true });

const InstagramData = mongoose.model('InstagramData', instagramDataSchema);

// MongoDB connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;  // Re-throw the error to ensure it fails early if the connection is not established
  }
};

// Function to convert "YES"/"NO" to Boolean
const convertToBoolean = (value) => {
  if (value === 'YES') return true;
  if (value === 'NO') return false;
  return value;
};

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const config = {
  api: {
    bodyParser: false, // Disable default body parser to handle file upload manually
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      // Ensure MongoDB is connected before handling the request
      await connectToDatabase();

      upload.single('file')(req, res, async (err) => {
        if (err) {
          console.error('Error uploading file:', err);
          return res.status(400).send('Error uploading file');
        }

        const buffer = req.file.buffer;

        // Parse the uploaded Excel file
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Data validation and mapping
        const mappedData = sheetData.map(item => {
          if (!item['Instagram ID'] || !item['Username']) {
            throw new Error('Missing required fields: Instagram ID or Username');
          }

          return {
            instagram_id: item['Instagram ID'],
            username: item['Username'],
            full_name: item['Full name'],
            profile_link: item['Profile link'],
            avatar_pic: item['Avatar pic'],
            followed_by_viewer: convertToBoolean(item['Followed by viewer']),
            is_verified: convertToBoolean(item['Is verified']),
            followers_count: item['Followers count'],
            following_count: item['Following count'],
            biography: item['Biography'],
            public_email: item['Public email'],
            posts_count: item['Posts count'],
            phone_country_code: item['Phone country code'],
            phone_number: item['Phone number'],
            city: item['City'],
            address: item['Address'],
            is_private: convertToBoolean(item['Is private']),
            is_business: convertToBoolean(item['Is business']),
            external_url: item['External url'],
          };
        });

        // Insert the mapped data into the database
        try {
          const savedData = await InstagramData.bulkWrite(
            mappedData.map(item => ({
              updateOne: {
                filter: { instagram_id: item.instagram_id },
                update: { $set: item },
                upsert: true, // Insert new or update existing based on instagram_id
              },
            }))
          );

          res.status(200).json({ message: 'File uploaded and data saved', data: savedData });
        } catch (err) {
          console.error('Error saving data to database:', err);
          res.status(500).send('Error saving data to database');
        }
      });
    } catch (err) {
      console.error('Error connecting to database:', err);
      res.status(500).send('Error connecting to the database');
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
