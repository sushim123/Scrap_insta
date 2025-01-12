
import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: String,
  filePath: String,
  fileType: String,
  size: Number,
}, { timestamps: true });

const File = mongoose.model('File', fileSchema);

export default File;
