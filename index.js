const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { ObjectId } = mongoose.Types; 


const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));


const eventSchema = new mongoose.Schema({
    event_name: { type: String, required: true },
    event_description: { type: String, required: true },
    sports: { type: [String], required: true },  // Array of sports
    event_organizer: { type: mongoose.Schema.Types.ObjectId, required: true },  // Organizer ID
    event_date: { type: Date, required: true },
    event_location: {
        address: { type: String, required: true },
        coordinates: {
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true }
        }
    },
    sub_events: [{
        sub_event_name: { type: String, required: true },
        sub_event_cost: { type: Number, required: true }
    }],
    photos: { type: [String], default: [] },  // Array of photos (max 3)
    interested_athletes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    registered_athletes: { type: [mongoose.Schema.Types.ObjectId], default: [] }
}, { collection: 'Events' });

const Event = mongoose.model('Event', eventSchema);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { files: 3 } });

// Upload file to GitHub
async function uploadFileToGitHub(fileName, fileContent, folderName) {
    const accessToken = process.env.GITHUB_TOKEN; // Load from .env
    const repositoryOwner = 'Volt-25';
    const repositoryName = 'cdn';

    const filePath = `${folderName}/${fileName}`;
    const apiUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/contents/${filePath}`;

    try {
        const response = await axios.put(apiUrl, {
            message: "Uploaded by server",
            content: fileContent.toString('base64'),
            branch: 'main'
        }, {
            headers: {
                Authorization: `token ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.content.download_url;
    } catch (error) {
        console.error('Error uploading file to GitHub:', error);
        throw error;
    }
}

// Upload photos to GitHub
async function uploadPhotosToGitHub(files) {
    const photoUrls = [];

    for (const file of files) {
        const compressedImageBuffer = await sharp(file.buffer)
            .resize(1200, 1200, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();

        const uniqueFileName = uuidv4() + '-' + file.originalname;
        const githubUrl = await uploadFileToGitHub(uniqueFileName, compressedImageBuffer, 'eventPhotos');

        photoUrls.push(githubUrl);
    }

    return photoUrls;
}

// Event creation route
app.post('/api/events', upload.array('photos', 3), async (req, res) => {
    try {
        const {
            event_name,
            event_description,
            sports,
            event_organizer,
            event_date,
            event_location,
            sub_events
        } = req.body;

        if (!event_name || !event_description || !sports || !event_organizer || !event_date || !event_location || !sub_events) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Upload photos to GitHub (if any)
        let photoUrls = [];
        if (req.files && req.files.length > 0) {
            photoUrls = await uploadPhotosToGitHub(req.files);
        }

        const newEvent = new Event({
            event_name,
            event_description,
            sports,
            event_organizer,
            event_date,
            event_location: {
                address: event_location.address,
                coordinates: {
                    latitude: event_location.coordinates.latitude,
                    longitude: event_location.coordinates.longitude
                }
            },
            sub_events,
            photos: photoUrls,
            interested_athletes: [],
            registered_athletes: []
        });

        const result = await newEvent.save();

        res.status(201).json({ _id: result._id });
    } catch (error) {
        console.error('Error adding event:', error);
        res.status(500).json({ error: 'An error occurred while adding the event.' });
    }
});




const athleteSchema = new mongoose.Schema({
    contact: String,
    username: String,
    name: String,
    type: String,
    bio: String,
    sports: [String],
    following: [String],
    followers: [String],
    profile_img: String,
}, { collection: 'Athletes' });

const Athlete = mongoose.model('Athlete', athleteSchema);

// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

async function uploadFileToGitHub(fileName, fileContent, folderName) {
    const accessToken = githubToken;
    const repositoryOwner = 'Volt-25';
    const repositoryName = 'cdn';

    // Use folderName to distinguish between profile images and post media
    const filePath = `${folderName}/${fileName}`;
    const apiUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/contents/${filePath}`;

    try {
        const response = await axios.put(apiUrl, {
            message: "Uploaded by server",
            content: fileContent.toString('base64'),
            branch: 'main'
        }, {
            headers: {
                Authorization: `token ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.content.download_url;
    } catch (error) {
        console.error('Error uploading file to GitHub:', error);
        throw error;
    }
}

app.put('/api/athletes/:athlete_id/profile-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const compressedImageBuffer = await sharp(req.file.buffer)
            .resize(800, 800, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();

        const uniqueFileName = uuidv4() + '-' + req.file.originalname;
        const githubUrl = await uploadFileToGitHub(uniqueFileName, compressedImageBuffer, 'profileImages');
        const updateFields = { profile_img: githubUrl };

        const result = await Athlete.updateOne({ _id: new mongoose.Types.ObjectId(req.params.athlete_id) }, { $set: updateFields });

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Athlete not found' });
        }

        res.status(200).json({ message: 'Profile image updated successfully' });
    } catch (error) {
        console.error('Error updating profile image:', error);
        res.status(500).json({ error: error.message });
    }
});






const clubsCollection = mongoose.model('Club', new mongoose.Schema({
    name: String,
    description: String,
    contact_numbers: [String],
    sports_taught: [String],
    organizer_name: String,
    location: {
        lat: Number,
        lng: Number
    },
    creator: mongoose.Schema.Types.ObjectId,
    admins: [mongoose.Schema.Types.ObjectId],
    members: [mongoose.Schema.Types.ObjectId],
    listed: Boolean,
    photos: { type: [String], default: [] }, // Array of photos (max 3)
    created_at: { type: Date, default: Date.now }
}, { collection: 'Clubs' }));

const groupsCollection = mongoose.model('GroupChat', new mongoose.Schema({
    club_id: mongoose.Schema.Types.ObjectId,
    participants: [{
        athleteId: mongoose.Schema.Types.ObjectId,
        lastSeen: Date,
        seen_last_message: Boolean
    }],
    messages: []
}, { collection: 'GroupMessaging' }));


app.post('/api/clubs', upload.array('photos', 3), async (req, res) => {
    try {
        const data = req.body;

        const club_name = data.name;
        const club_description = data.description || '';
        const club_contact_numbers = data.contact_numbers || [];
        const sports_taught = data.sports_taught || [];
        const club_organizer_name = data.organizer_name || '';
        const club_location = data.location || { lat: null, lng: null };
        const listed = data.listed || false;
        const creator_id = new mongoose.Types.ObjectId(data.creator);
        
        // Handle members; default to an empty array if not provided
        const initial_members = (data.members || []).map(member_id => new mongoose.Types.ObjectId(member_id));

        // Upload photos to GitHub (if any)
        let photoUrls = [];
        if (req.files && req.files.length > 0) {
            photoUrls = await uploadPhotosToGitHub(req.files);
        }

        const club = new clubsCollection({
            _id: new mongoose.Types.ObjectId(),
            name: club_name,
            description: club_description,
            contact_numbers: club_contact_numbers,
            sports_taught: sports_taught,
            organizer_name: club_organizer_name,
            location: club_location,
            creator: creator_id,
            admins: [creator_id],
            members: initial_members,
            listed: listed,
            photos: photoUrls,
            created_at: new Date()
        });

        await club.save();

        const groupChat = new groupsCollection({
            _id: new mongoose.Types.ObjectId(),
            club_id: club._id,
            participants: [
                { athleteId: creator_id, lastSeen: new Date(), seen_last_message: true },
                ...initial_members.map(member_id => ({
                    athleteId: member_id, lastSeen: new Date(), seen_last_message: false
                }))
            ],
            messages: []
        });

        await groupChat.save();

        return res.json({
            status: 'Club and group chat created',
            club_id: club._id.toString(),
            group_chat_id: groupChat._id.toString()
        });
    } catch (error) {
        console.error('Error creating club:', error);
        return res.status(500).json({ error: 'An error occurred while creating the club.' });
    }
});


const gymSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    contact_numbers: { type: [String], default: [] },
    facilities: { type: [String], default: [] }, // Array of facilities like 'Weights', 'Cardio', etc.
    location: {
        address: { type: String, required: true },
        coordinates: {
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true }
        }
    },
    creator: { type: mongoose.Schema.Types.ObjectId, required: true }, // Creator ID
    photos: { type: [String], default: [] }, // Array of photos (max 3)
    created_at: { type: Date, default: Date.now }
}, { collection: 'Gyms' });

const gymsCollection = mongoose.model('Gym', gymSchema);


app.post('/api/gyms', upload.array('photos', 3), async (req, res) => {
    try {
        const data = req.body;

        const {
            name,
            description,
            contact_numbers,
            facilities,
            location,
            creator
        } = data;

        if (!name || !location || !location.address || !location.coordinates || !creator) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Upload photos to GitHub (if any)
        let photoUrls = [];
        if (req.files && req.files.length > 0) {
            photoUrls = await uploadPhotosToGitHub(req.files);
        }

        const gym = new gymsCollection({
            _id: new mongoose.Types.ObjectId(),
            name,
            description: description || '',
            contact_numbers: contact_numbers || [],
            facilities: facilities || [],
            location: {
                address: location.address,
                coordinates: {
                    latitude: location.coordinates.latitude,
                    longitude: location.coordinates.longitude
                }
            },
            creator: new mongoose.Types.ObjectId(creator),
            photos: photoUrls,
            created_at: new Date()
        });

        await gym.save();

        return res.json({
            status: 'Gym created successfully',
            gym_id: gym._id.toString()
        });
    } catch (error) {
        console.error('Error creating gym:', error);
        return res.status(500).json({ error: 'An error occurred while creating the gym.' });
    }
});








const postSchema = new mongoose.Schema({
    athlete_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Athlete' },
    media_url: String,
    caption: String,
    media_type: { type: String, enum: ['photo', 'video'] },
    created_at: { type: Date, default: Date.now }
}, { collection: 'AthletePosts' });

const AthletePost = mongoose.model('AthletePost', postSchema);


app.post('/api/athletes/:athlete_id/posts', upload.single('media'), async (req, res) => {
    try {
        const { caption, media_type } = req.body;

        if (!req.file || !['photo', 'video'].includes(media_type)) {
            return res.status(400).json({ error: 'Invalid media file or media type' });
        }

        let mediaBuffer = req.file.buffer;
        if (media_type === 'photo') {
            mediaBuffer = await sharp(mediaBuffer)
                .resize(1200, 1200, { fit: 'inside' })
                .jpeg({ quality: 80 })
                .toBuffer();
        }

        const uniqueFileName = uuidv4() + '-' + req.file.originalname;
        const mediaUrl = await uploadFileToGitHub(uniqueFileName, mediaBuffer, 'postMedia');

        const newPost = new AthletePost({
            athlete_id: req.params.athlete_id,
            media_url: mediaUrl,
            caption: caption || '',
            media_type: media_type,
        });

        await newPost.save();

        res.status(201).json({ message: 'Post created successfully', post_id: newPost._id });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: error.message });
    }
});






const certificateSchema = new mongoose.Schema({
    athlete_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Athlete' },
    images: { type: [String], required: true },  // Array of image URLs (max 3)
    created_at: { type: Date, default: Date.now }
}, { collection: 'Certificates' });

const Certificate = mongoose.model('Certificate', certificateSchema);


app.post('/api/athletes/:athlete_id/certificates', upload.array('images', 3), async (req, res) => {
    try {
        const athlete_id = req.params.athlete_id;
        
        // Ensure at least one image is provided
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'At least one image is required' });
        }

        // Process and compress each image before uploading to GitHub
        const imageUrls = [];
        for (let file of req.files) {
            const compressedImageBuffer = await sharp(file.buffer)
                .resize(800, 800, { fit: 'inside' }) // Resize image to fit within 800x800 dimensions
                .jpeg({ quality: 75 }) // Compress image with 75% quality
                .toBuffer();

            // Upload the compressed image to GitHub and store the URL in the "certificateImages" folder
            const githubUrl = await uploadFileToGitHub(uuidv4() + '-' + file.originalname, compressedImageBuffer, 'certificateImages');
            imageUrls.push(githubUrl);
        }

        // Save certificate details in the database
        const newCertificate = new Certificate({
            athlete_id: new mongoose.Types.ObjectId(athlete_id),
            images: imageUrls,
            created_at: new Date()
        });

        await newCertificate.save();

        res.status(201).json({ message: 'Certificate added successfully', certificate_id: newCertificate._id });
    } catch (error) {
        console.error('Error creating certificate:', error);
        res.status(500).json({ error: 'An error occurred while adding the certificate.' });
    }
});




//------------------------------------------- DELETION --------------------------------------------------------------


// Delete file from GitHub
async function deleteFileFromGitHub(filePath) {
    const accessToken = githubToken;
    const repositoryOwner = 'Volt-25';
    const repositoryName = 'cdn';
    const apiUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/contents/${filePath}`;

    try {
        // Fetch file data to get the `sha`
        const fileDataResponse = await axios.get(apiUrl, {
            headers: {
                Authorization: `token ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        const fileSha = fileDataResponse.data.sha;

        // Delete the file
        await axios.delete(apiUrl, {
            headers: {
                Authorization: `token ${accessToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                message: 'Delete image file',
                sha: fileSha,
                branch: 'main'
            }
        });

        console.log('File deleted from GitHub:', filePath);
    } catch (error) {
        console.error('Error deleting file from GitHub:', error);
        throw error;
    }
}




app.delete('/api/athletes/:athlete_id/profile-image', async (req, res) => {
    try {
        const athlete = await Athlete.findById(req.params.athlete_id);

        if (!athlete || !athlete.profile_img) {
            return res.status(404).json({ error: 'Profile image not found' });
        }

        // Delete profile image from GitHub
        const filePath = athlete.profile_img.split('/').slice(-2).join('/');
        await deleteFileFromGitHub(filePath);

        // Update athlete's profile image field
        athlete.profile_img = null;
        await athlete.save();

        res.status(200).json({ message: 'Profile image deleted successfully' });
    } catch (error) {
        console.error('Error deleting profile image:', error);
        res.status(500).json({ error: error.message });
    }
});


app.delete('/api/athletes/:athlete_id/posts/:post_id', async (req, res) => {
    try {
        const post = await AthletePost.findById(req.params.post_id);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Delete post media from GitHub
        const filePath = post.media_url.split('/').slice(-2).join('/');
        await deleteFileFromGitHub(filePath);

        await AthletePost.deleteOne({ _id: post._id });
        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: error.message });
    }
});


app.delete('/api/events/:event_id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.event_id);

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Delete event photos from GitHub
        for (const photoUrl of event.photos) {
            const filePath = photoUrl.split('/').slice(-2).join('/'); // Extract GitHub path from URL
            await deleteFileFromGitHub(filePath);
        }

        await Event.deleteOne({ _id: event._id });
        res.status(200).json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/clubs/:club_id', async (req, res) => {
    try {
        const club = await clubsCollection.findById(req.params.club_id);

        if (!club) {
            return res.status(404).json({ error: 'Club not found' });
        }

        // Delete club photos from GitHub
        for (const photoUrl of club.photos) {
            const filePath = photoUrl.split('/').slice(-2).join('/');
            await deleteFileFromGitHub(filePath);
        }

        await clubsCollection.deleteOne({ _id: club._id });
        res.status(200).json({ message: 'Club deleted successfully' });
    } catch (error) {
        console.error('Error deleting club:', error);
        res.status(500).json({ error: error.message });
    }
});
















app.get('/', (req, res) => {
    res.send('Hello, VOLT 2!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
