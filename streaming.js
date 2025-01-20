const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

// Middleware for handling video streaming
app.get('/video', async (req, res) => {
    try {
        // URL of the video
        const videoUrl = 'https://volt-25.github.io/cdn-2/test/testVideo.mp4';

        // Get the range header from the client request
        const range = req.headers.range;
        if (!range) {
            return res.status(400).send('Requires Range header');
        }

        // Get video size using a HEAD request
        const { headers } = await axios.head(videoUrl);
        const videoSize = parseInt(headers['content-length'], 10);

        // Parse range header
        const CHUNK_SIZE = 10 ** 6; // 1MB chunks
        const start = Number(range.replace(/\D/g, ''));
        const end = Math.min(start + CHUNK_SIZE - 1, videoSize - 1);

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

        // Stream the video chunk
        const videoStream = await axios.get(videoUrl, {
            headers: {
                Range: `bytes=${start}-${end}`,
            },
            responseType: 'stream',
        });

        // Log when the video stream starts
        console.log(`Stream started: bytes ${start}-${end}`);

        // Pipe the video data to the response
        videoStream.data.pipe(res);

        // Log when the video chunk has been fully piped
        videoStream.data.on('end', () => {
            console.log(`Streamed chunk: ${start}-${end} successfully.`);
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
