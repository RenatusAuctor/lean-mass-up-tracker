// Vercel Serverless Function: api/feed.js
export default async function handler(req, res) {
    // FIREBASE_DB_URL should be set in Vercel Environment Variables
    const FIREBASE_URL = process.env.FIREBASE_DB_URL; 
    
    if (!FIREBASE_URL) {
        return res.status(500).json({ error: 'FIREBASE_DB_URL is not set on the server.' });
    }

    const endpoint = FIREBASE_URL.endsWith('.json') ? FIREBASE_URL : `${FIREBASE_URL}/feed.json`;

    if (req.method === 'GET') {
        try {
            const response = await fetch(`${endpoint}?orderBy="$key"&limitToLast=10`);
            if (!response.ok) throw new Error('Failed to fetch feed');
            const data = await response.json();
            return res.status(200).json(data || {});
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch global feed.' });
        }
    }

    if (req.method === 'POST') {
        const { message, food, calories, timestamp } = req.body;
        
        // Basic validation to prevent garbage data injection
        if (!message || typeof message !== 'string' || message.length > 50) {
            return res.status(400).json({ error: 'Invalid message' });
        }
        if (!food || typeof food !== 'string' || food.length > 50) {
            return res.status(400).json({ error: 'Invalid food name' });
        }
        if (typeof calories !== 'number' || calories < 0 || calories > 5000) {
            return res.status(400).json({ error: 'Invalid calories' });
        }

        const data = {
            message,
            food,
            calories,
            timestamp: timestamp || Date.now()
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to post feed');
            
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to post global feed.' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
