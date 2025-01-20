const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware for handling video streaming
app.get('/video', async (req, res) => {
    try {
        // Path to the local video file (same directory as this script)
        const videoPath = path.join(__dirname, 'testVideo.mp4');
        
        // Check if the file exists
        if (!fs.existsSync(videoPath)) {
            return res.status(404).send('Video file not found');
        }

        // Get the range header from the client request
        const range = req.headers.range;
        if (!range) {
            return res.status(400).send('Requires Range header');
        }

        // Get video file stats to determine its size
        const videoStats = fs.statSync(videoPath);
        const videoSize = videoStats.size;

        // Parse range header
        const CHUNK_SIZE = 10 ** 6; // 1MB chunks
        const start = Number(range.replace(/\D/g, ''));
        const end = Math.min(start + CHUNK_SIZE - 1, videoSize - 1);

        // Ensure start is within bounds
        if (start > videoSize) {
            return res.status(416).send('Requested Range Not Satisfiable');
        }

        // Log the requested range and chunk details
        console.log(`Requested video range: bytes ${start}-${end}/${videoSize}`);

        // Set headers for partial content
        const contentLength = end - start + 1;
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${videoSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': contentLength,
            'Content-Type': 'video/mp4',
        });

        // Log that we're about to stream the video
        console.log(`Streaming chunk: ${start}-${end}, content-length: ${contentLength}`);

        // Create a read stream for the video file, starting from the requested range
        const videoStream = fs.createReadStream(videoPath, { start, end });

        // Log when the video stream starts
        console.log(`Stream started: bytes ${start}-${end}`);

        // Pipe the video data to the response
        videoStream.pipe(res);

        // Log when the video chunk has been fully piped
        videoStream.on('end', () => {
            console.log(`Streamed chunk: ${start}-${end} successfully.`);
        });

        // Handle stream errors
        videoStream.on('error', (err) => {
            console.error('Stream error:', err);
            res.status(500).send('Internal Server Error');
        });

    } catch (error) {
        console.error('Error streaming video:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
