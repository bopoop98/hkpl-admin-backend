// backend/server.js
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

// --- Firebase Admin SDK Initialization ---
let serviceAccount;
try {
    // For Vercel deployments (including development, preview, and production environments),
    // always load from the FIREBASE_SERVICE_ACCOUNT_KEY environment variable.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
        // This block is only for truly local development outside of `vercel dev`
        // where you might still rely on a local serviceAccountKey.json file.
        // It's highly recommended to use `vercel dev` or a local .env file instead.
        console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found. Attempting to load from local serviceAccountKey.json.');
        serviceAccount = require('./serviceAccountKey.json'); // Make sure this path is correct relative to server.js
    } else {
        // This indicates a misconfiguration in production or Vercel development env.
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Cannot initialize Firebase Admin SDK securely.');
    }

    if (!admin.apps.length) { // Prevents re-initialization in environments that might hot-reload (like local dev)
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
            // If you're using Realtime Database or Storage, add databaseURL:
            // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        });
        console.log('Firebase Admin SDK initialized successfully.');
    } else {
        console.log('Firebase Admin SDK already initialized.');
    }
} catch (error) {
    console.error("CRITICAL ERROR: Failed to initialize Firebase Admin SDK:", error.message);
    console.error("Action Required: Ensure FIREBASE_SERVICE_ACCOUNT_KEY environment variable is correctly set in Vercel (as a single-line JSON string), or serviceAccountKey.json exists locally for development.");
    // In a serverless function, throwing an error here will cause the function invocation to fail.
    // This is generally desired for critical startup failures.
    throw new Error('Firebase Admin SDK initialization failed.');
}

const db = admin.firestore();
const auth = admin.auth(); // Get auth instance for verifyIdToken

// --- Middleware ---
// Configure CORS to allow requests from your frontend's domain
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Default for local dev if FRONTEND_URL isn't set
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // OPTIONS for preflight requests
    credentials: true // If your frontend sends cookies/auth headers
}));
app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// --- Health Check (before auth middleware) ---
// This route is for Vercel (and other platforms) to check if your function is alive.
// It should not require authentication.
app.get('/', (req, res) => {
    res.status(200).send('Admin Panel Backend is running!');
});

// --- Basic Admin Authentication Middleware (IMPORTANT!) ---
// This middleware runs BEFORE your specific API routes, ensuring all subsequent routes are protected.
app.use(async (req, res, next) => {
    // For OPTIONS (preflight) requests, just pass through. CORS handles them.
    if (req.method === 'OPTIONS') {
        return next();
    }

    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        req.user = decodedToken; // Attach decoded token to request for downstream use
        console.log('User authenticated:', decodedToken.uid);

        // Optional: Add logic here to check if the user has an 'admin' custom claim.
        // Example: If you set a custom claim 'admin: true'
        // if (!decodedToken.admin) {
        //     return res.status(403).json({ message: 'Forbidden: User is not an admin.' });
        // }

        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        res.status(403).json({ message: 'Unauthorized: Invalid or expired token.' });
    }
});

// --- Constants for Firestore Paths ---
const LEAGUE_BASE_PATH = 'artifacts/hkplweb/public/data/leagues/hkpl';
const TEAMS_COLLECTION = `${LEAGUE_BASE_PATH}/teams`;
const PLAYERS_COLLECTION = `${LEAGUE_BASE_PATH}/players`;
const NEWS_COLLECTION = `${LEAGUE_BASE_PATH}/news`;
const MATCHES_COLLECTION = `${LEAGUE_BASE_PATH}/matches`;

// --- Helper for Date Parsing (New Function) ---
// Parses a "DD-MM-YYYY" string into a Date object
function parseDDMMYYYYToDate(ddmmyyyy) {
    const parts = ddmmyyyy.split('-');
    if (parts.length !== 3) {
        throw new Error('Invalid date format. Expected DD-MM-YYYY.');
    }
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
}

// --- Helper for Daily Sequential ID Generation ---
async function generateDailySequentialId(collectionRef, prefix, dateStringDDMMYYYY) {
    // Count matches/news with the same date string
    const snapshot = await collectionRef.where('date', '==', dateStringDDMMYYYY).get();
    const count = snapshot.size;
    const sequentialNum = (count + 1).toString().padStart(2, '0'); // e.g., 01, 02
    return `${dateStringDDMMYYYY.replace(/-/g, '')}-${sequentialNum}`; // Format DDMMYYYY-NN
}

// --- Admin API Routes ---
// IMPORTANT: These routes no longer include '/api' prefix here,
// as the vercel.json rewrite will handle that.
// Frontend will call '/api/teams', but here it's just '/teams'.

// 1. Teams Management
// Fields: LogoUrl(string),draw(number),ga(number),gf(number),lost(number),name(string),name_mm(string),played(number),won(number)
app.get('/teams', async (req, res) => { // Removed /api/
    try {
        const snapshot = await db.collection(TEAMS_COLLECTION).get();
        const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(teams);
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ message: 'Error fetching teams' });
    }
});

app.post('/teams', async (req, res) => { // Removed /api/
    try {
        const newTeamData = {
            LogoUrl: req.body.LogoUrl || '',
            draw: Number(req.body.draw) || 0,
            ga: Number(req.body.ga) || 0,
            gf: Number(req.body.gf) || 0,
            lost: Number(req.body.lost) || 0,
            name: req.body.name || '',
            name_mm: req.body.name_mm || '',
            played: Number(req.body.played) || 0,
            won: Number(req.body.won) || 0,
        };

        // Basic validation
        if (!newTeamData.name) {
            return res.status(400).json({ message: 'Team name is required.' });
        }

        const docRef = await db.collection(TEAMS_COLLECTION).add(newTeamData);
        res.status(201).json({ message: 'Team added successfully', id: docRef.id });
    } catch (error) {
        console.error('Error adding team:', error);
        res.status(500).json({ message: 'Error adding team' });
    }
});

app.put('/teams/:id', async (req, res) => { // Removed /api/
    try {
        const teamId = req.params.id;
        const updatedData = {
            LogoUrl: req.body.LogoUrl,
            draw: req.body.draw !== undefined ? Number(req.body.draw) : undefined, // Ensure numbers are numbers, but allow undefined for partial updates
            ga: req.body.ga !== undefined ? Number(req.body.ga) : undefined,
            gf: req.body.gf !== undefined ? Number(req.body.gf) : undefined,
            lost: req.body.lost !== undefined ? Number(req.body.lost) : undefined,
            name: req.body.name,
            name_mm: req.body.name_mm,
            played: req.body.played !== undefined ? Number(req.body.played) : undefined,
            won: req.body.won !== undefined ? Number(req.body.won) : undefined,
        };
        // Filter out undefined values if fields are optional in the request
        Object.keys(updatedData).forEach(key => updatedData[key] === undefined && delete updatedData[key]);

        await db.collection(TEAMS_COLLECTION).doc(teamId).update(updatedData);
        res.json({ message: 'Team updated successfully' });
    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({ message: 'Error updating team' });
    }
});

app.delete('/teams/:id', async (req, res) => { // Removed /api/
    try {
        const teamId = req.params.id;
        await db.collection(TEAMS_COLLECTION).doc(teamId).delete();
        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ message: 'Error deleting team' });
    }
});


// 2. Players Management
// Fields: imageUrl(string), name(string), name_en(string), number(number), position(string), team_id(string)
app.get('/players', async (req, res) => { // Removed /api/
    try {
        const snapshot = await db.collection(PLAYERS_COLLECTION).get();
        const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(players);
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ message: 'Error fetching players' });
    }
});

app.post('/players', async (req, res) => { // Removed /api/
    try {
        // Generating ID for players if needed, but Firebase .add() generates one too.
        // If you need a custom ID with prefix, ensure it's truly unique or handle conflicts.
        // const newPlayerId = `hkpl_${db.collection(PLAYERS_COLLECTION).doc().id}`; // Original custom ID approach

        const newPlayerData = {
            imageUrl: req.body.imageUrl || '',
            name: req.body.name || '',
            name_en: req.body.name_en || '',
            number: Number(req.body.number) || 0,
            position: req.body.position || '',
            team_id: req.body.team_id || '',
        };

        // Basic validation
        if (!newPlayerData.name || !newPlayerData.team_id || !newPlayerData.position) {
            return res.status(400).json({ message: 'Player name, team, and position are required.' });
        }
        const allowedPositions = ['GK', 'DF', 'MF', 'FW'];
        if (!allowedPositions.includes(newPlayerData.position)) {
            return res.status(400).json({ message: 'Invalid player position. Must be GK, DF, MF, or FW.' });
        }

        // Use add() for auto-generated Firestore ID, or set() with a custom ID if you uncommented newPlayerId
        const docRef = await db.collection(PLAYERS_COLLECTION).add(newPlayerData);
        res.status(201).json({ message: 'Player added successfully', id: docRef.id }); // Return Firestore's auto-generated ID
    } catch (error) {
        console.error('Error adding player:', error);
        res.status(500).json({ message: 'Error adding player' });
    }
});

app.put('/players/:id', async (req, res) => { // Removed /api/
    try {
        const playerId = req.params.id;
        const updatedData = {
            imageUrl: req.body.imageUrl,
            name: req.body.name,
            name_en: req.body.name_en,
            number: req.body.number !== undefined ? Number(req.body.number) : undefined,
            position: req.body.position,
            team_id: req.body.team_id,
        };
        Object.keys(updatedData).forEach(key => updatedData[key] === undefined && delete updatedData[key]);

        if (updatedData.position) {
            const allowedPositions = ['GK', 'DF', 'MF', 'FW'];
            if (!allowedPositions.includes(updatedData.position)) {
                return res.status(400).json({ message: 'Invalid player position. Must be GK, DF, MF, or FW.' });
            }
        }

        await db.collection(PLAYERS_COLLECTION).doc(playerId).update(updatedData);
        res.json({ message: 'Player updated successfully' });
    } catch (error) {
        console.error('Error updating player:', error);
        res.status(500).json({ message: 'Error updating player' });
    }
});

app.delete('/players/:id', async (req, res) => { // Removed /api/
    try {
        const playerId = req.params.id;
        await db.collection(PLAYERS_COLLECTION).doc(playerId).delete();
        res.json({ message: 'Player deleted successfully' });
    } catch (error) {
        console.error('Error deleting player:', error);
        res.status(500).json({ message: 'Error deleting player' });
    }
});


// 3. News Management
// Fields: body(string), date(Timestamp), imgUrl(array), tags(array), title(string)
app.get('/news', async (req, res) => { // Removed /api/
    try {
        const snapshot = await db.collection(NEWS_COLLECTION).orderBy('date', 'desc').get(); // Order by date for display
        const news = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(news);
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ message: 'Error fetching news' });
    }
});

app.post('/news', async (req, res) => { // Removed /api/
    try {
        const currentLocalDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // Format YYYYMMDD
        // The generateDailySequentialId helper expects DD-MM-YYYY, so let's adjust for consistency
        // or ensure currentLocalDate is DD-MM-YYYY if that's the desired ID part.
        // For simplicity, let's make `currentLocalDate` match `DDMMYYYY` for the ID
        const dateForId = new Date().toLocaleDateString('en-GB').replace(/\//g, '-'); // "DD-MM-YYYY"
        const newNewsId = await generateDailySequentialId(db.collection(NEWS_COLLECTION), 'news', dateForId);

        const newNewsData = {
            body: req.body.body || '',
            date: admin.firestore.Timestamp.fromDate(new Date()), // Store current timestamp for ordering
            imgUrl: Array.isArray(req.body.imgUrl) ? req.body.imgUrl : [],
            tags: Array.isArray(req.body.tags) ? req.body.tags : [],
            title: req.body.title || '',
        };

        if (!newNewsData.title || !newNewsData.body) {
            return res.status(400).json({ message: 'News title and body are required.' });
        }

        await db.collection(NEWS_COLLECTION).doc(newNewsId).set(newNewsData);
        res.status(201).json({ message: 'News article added successfully', id: newNewsId });
    } catch (error) {
        console.error('Error adding news:', error);
        res.status(500).json({ message: 'Error adding news' });
    }
});

app.put('/news/:id', async (req, res) => { // Removed /api/
    try {
        const newsId = req.params.id;
        const updatedData = {
            body: req.body.body,
            // date: We generally don't update creation date unless specific requirement
            imgUrl: Array.isArray(req.body.imgUrl) ? req.body.imgUrl : undefined,
            tags: Array.isArray(req.body.tags) ? req.body.tags : undefined,
            title: req.body.title,
        };
        Object.keys(updatedData).forEach(key => updatedData[key] === undefined && delete updatedData[key]);

        await db.collection(NEWS_COLLECTION).doc(newsId).update(updatedData);
        res.json({ message: 'News article updated successfully' });
    } catch (error) {
        console.error('Error updating news:', error);
        res.status(500).json({ message: 'Error updating news' });
    }
});

app.delete('/news/:id', async (req, res) => { // Removed /api/
    try {
        const newsId = req.params.id;
        await db.collection(NEWS_COLLECTION).doc(newsId).delete();
        res.json({ message: 'News article deleted successfully' });
    } catch (error) {
        console.error('Error deleting news:', error);
        res.status(500).json({ message: 'Error deleting news' });
    }
});


// 4. Matches Management
// Fields: awayScore(number),awayTeamId(string),date(string),homeScore(number),homeTeamId(string),status(string),time(string)
app.get('/matches', async (req, res) => { // Removed /api/
    try {
        // Query matches, ordering by date (which is now string "DD-MM-YYYY") and then time
        // Note: Ordering by string "DD-MM-YYYY" might not be truly chronological.
        // For accurate date ordering, consider storing date as a Firestore Timestamp or YYYY-MM-DD.
        const snapshot = await db.collection(MATCHES_COLLECTION)
                                 .orderBy('date', 'desc')
                                 .orderBy('time', 'desc')
                                 .get();
        const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(matches);
    } catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({ message: 'Error fetching matches' });
    }
});

app.post('/matches', async (req, res) => { // Removed /api/
    try {
        const matchDateStringDDMMYYYY = req.body.date; // Frontend sends DD-MM-YYYY
        if (!matchDateStringDDMMYYYY || !/^\d{2}-\d{2}-\d{4}$/.test(matchDateStringDDMMYYYY)) {
            return res.status(400).json({ message: 'Match date must be in "DD-MM-YYYY" format.' });
        }
        // parseDDMMYYYYToDate(matchDateStringDDMMYYYY); // This line is not used here but could be for date objects

        const newMatchId = await generateDailySequentialId(db.collection(MATCHES_COLLECTION), 'match', matchDateStringDDMMYYYY);
        // Prevent overwrite: check if matchId already exists
        const existing = await db.collection(MATCHES_COLLECTION).doc(newMatchId).get();
        if (existing.exists) {
            return res.status(409).json({ message: 'A match with this ID already exists for this date.' });
        }

        const newMatchData = {
            awayScore: Number(req.body.awayScore) || 0,
            awayTeamId: req.body.awayTeamId || '',
            date: matchDateStringDDMMYYYY, // Store as string (DD-MM-YYYY)
            homeScore: Number(req.body.homeScore) || 0,
            homeTeamId: req.body.homeTeamId || '',
            status: req.body.status || 'upcoming',
            time: req.body.time || '00:00',
            matchId: newMatchId, // Store the generated ID
        };

        // Basic validation
        if (!newMatchData.homeTeamId || !newMatchData.awayTeamId || !newMatchData.date || !newMatchData.time || !newMatchData.status) {
            return res.status(400).json({ message: 'All match fields (teams, date, time, status) are required.' });
        }
        const allowedStatuses = ['ongoing', 'upcoming', 'finished'];
        if (!allowedStatuses.includes(newMatchData.status)) {
            return res.status(400).json({ message: 'Invalid match status. Must be ongoing, upcoming, or finished.' });
        }

        await db.collection(MATCHES_COLLECTION).doc(newMatchId).set(newMatchData);
        res.status(201).json({ message: 'Match added successfully', id: newMatchId });
    } catch (error) {
        console.error('Error adding match:', error);
        res.status(500).json({ message: 'Error adding match' });
    }
});

app.put('/matches/:id', async (req, res) => { // Removed /api/
    try {
        const matchId = req.params.id;
        const updatedData = {
            awayScore: req.body.awayScore !== undefined ? Number(req.body.awayScore) : undefined,
            awayTeamId: req.body.awayTeamId,
            date: req.body.date, // This will be the DD-MM-YYYY string from frontend, need to validate
            homeScore: req.body.homeScore !== undefined ? Number(req.body.homeScore) : undefined,
            homeTeamId: req.body.homeTeamId,
            status: req.body.status,
            time: req.body.time,
        };
        // Filter out undefined values from request body
        Object.keys(updatedData).forEach(key => updatedData[key] === undefined && delete updatedData[key]);

        if (updatedData.status) {
            const allowedStatuses = ['ongoing', 'upcoming', 'finished'];
            if (!allowedStatuses.includes(updatedData.status)) {
                return res.status(400).json({ message: 'Invalid match status. Must be ongoing, upcoming, or finished.' });
            }
        }
        if (updatedData.date) { // If date is being updated, validate format only
            if (!/^\d{2}-\d{2}-\d{4}$/.test(updatedData.date)) {
                return res.status(400).json({ message: 'Match date must be in "DD-MM-YYYY" format.' });
            }
            // Keep as string, do not convert to Timestamp for this field
        }

        await db.collection(MATCHES_COLLECTION).doc(matchId).update(updatedData);
        res.json({ message: 'Match updated successfully' });
    } catch (error) {
        console.error('Error updating match:', error);
        res.status(500).json({ message: 'Error updating match' });
    }
});

app.delete('/matches/:id', async (req, res) => { // Removed /api/
    try {
        const matchId = req.params.id;
        await db.collection(MATCHES_COLLECTION).doc(matchId).delete();
        res.json({ message: 'Match deleted successfully' });
    } catch (error) {
        console.error('Error deleting match:', error);
        res.status(500).json({ message: 'Error deleting match' });
    }
});


// --- Export the Express app for Vercel ---
// This is the CRITICAL line for Vercel deployment.
module.exports = app;

// --- Local Development Server (Conditional) ---
// This part will only run when you run 'node backend/server.js' locally
// It will NOT run when deployed on Vercel.
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Local backend server running on http://localhost:${PORT}`);
    });
}
