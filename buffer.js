const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { Schema } = mongoose;

const app = express();
const PORT = 3000;

// MongoDB connection
mongoose.connect('mongodb+srv://volt-backend-2:7YvG38PkQFVKprQ7@theplasma.flv6npg.mongodb.net/Buffer?retryWrites=true&w=majority&appName=thePlasma', {
    useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));
  

// Define a file schema and model
const fileSchema = new Schema({
    data: Buffer,
    contentType: String,
    fileName: String,
  });
  
  const File = mongoose.model('File', fileSchema);
  
  // Configure multer for file uploads
  const storage = multer.memoryStorage();
  const upload = multer({ storage });
  
  // POST route to upload a file (any type)
  app.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
  
      const newFile = new File({
        data: req.file.buffer,
        contentType: req.file.mimetype,
        fileName: req.file.originalname,
      });
  
      const savedFile = await newFile.save();
      res.status(201).json({ message: 'File uploaded successfully', id: savedFile._id });
    } catch (err) {
      res.status(500).json({ message: 'Error uploading file', error: err.message });
    }
  });
  
  // GET route to retrieve a file by its ID
  app.get('/file/:id', async (req, res) => {
    try {
      const file = await File.findById(req.params.id);
  
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
  
      res.contentType(file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${file.fileName}`);
      res.send(file.data);
    } catch (err) {
      res.status(500).json({ message: 'Error retrieving file', error: err.message });
    }
  });
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });