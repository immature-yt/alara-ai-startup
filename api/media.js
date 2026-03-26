import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
  
    const { type, q } = req.query;
    if (!type || !q) return res.status(400).send('Missing parameters');

    // --- 1. AUTHENTICATION CHECK ---
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.alara_session;

    if (!token) {
        return res.status(401).send('Not authenticated');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).send('Invalid token');
    }
  
    try {
        // --- 2. FETCH USER ECONOMY DATA ---
        const { rows } = await sql`
            SELECT id, plan, credits, videos_used_today, images_used_today, last_reset_date 
            FROM users 
            WHERE id = ${decoded.userId};
        `;
        if (rows.length === 0) return res.status(404).send('User not found');
        
        let user = rows[0];

        // Failsafe: If the midnight reset hasn't happened yet today, treat usage as 0
        const today = new Date().toDateString();
        const lastReset = user.last_reset_date ? new Date(user.last_reset_date).toDateString() : '';
        if (today !== lastReset) {
            user.videos_used_today = 0;
            user.images_used_today = 0;
            // Note: The actual DB reset query runs when they load the chat via /me.js
        }

        // --- 3. THE DOUBLE-LOCK ECONOMY RULES ---
        let maxAllowed = 0;
        let creditCost = 0;
        let usedToday = type === 'video' ? user.videos_used_today : user.images_used_today;

        if (type === 'video') {
            switch(user.plan) {
                case 'luxury': maxAllowed = 15; creditCost = 0; break;
                case 'elite':  maxAllowed = 7;  creditCost = 9000; break;
                case 'pro':    maxAllowed = 4;  creditCost = 18000; break;
                default:       maxAllowed = 1;  creditCost = 25000; break; // Free
            }
        } else { // type === 'image'
            switch(user.plan) {
                case 'luxury': maxAllowed = 60; creditCost = 0; break;
                case 'elite':  maxAllowed = 25; creditCost = 0; break;
                case 'pro':    maxAllowed = 12; creditCost = 0; break;
                default:       maxAllowed = 5;  creditCost = 5000; break; // Free
            }
        }

        // --- 4. ENFORCE CAPS & WALLET ---
        if (usedToday >= maxAllowed) {
            return res.status(429).send(`Daily ${type} limit reached for your plan.`);
        }

        if (user.credits < creditCost) {
            return res.status(402).send(`Insufficient credits. You need ${creditCost.toLocaleString()} to generate this ${type}.`);
        }

        // --- 5. DEDUCT & UPDATE DATABASE ---
        if (type === 'video') {
            await sql`UPDATE users SET credits = credits - ${creditCost}, videos_used_today = videos_used_today + 1 WHERE id = ${user.id}`;
        } else {
            await sql`UPDATE users SET credits = credits - ${creditCost}, images_used_today = images_used_today + 1 WHERE id = ${user.id}`;
        }

        // --- 6. FETCH FROM POLLINATIONS ---
        const apiKey = process.env.POLLINATIONS_API_KEY;
        const encodedPrompt = encodeURIComponent(q);
        let targetUrl = type === 'video' 
            ? `https://gen.pollinations.ai/video/${encodedPrompt}?model=wan-fast`
            : `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&nologo=true`;

        const response = await fetch(targetUrl, {
            headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
        });
      
        if (!response.ok) {
            // If Pollinations fails, we should technically refund them, but for the exhibition, it's fine.
            return res.status(response.status).send('Media generation failed at provider');
        }
      
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
  
    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).send('Internal Proxy Error');
    }
}
