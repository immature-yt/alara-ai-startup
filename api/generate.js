import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Authenticate Request
    const cookies = cookie.parse(request.headers.cookie || '');
    const token = cookies.alara_session;
    
    if (!token) return response.status(401).json({ error: 'Unauthorized. Please log in.' });

    let userId;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
    } catch (error) {
        return response.status(401).json({ error: 'Invalid session token.' });
    }

    // 2. Fetch User's Current Credits
    let user;
    try {
        const { rows } = await sql`SELECT plan, credits FROM users WHERE id = ${userId}`;
        user = rows[0];
    } catch (e) {
        return response.status(500).json({ error: 'Database connection error' });
    }

    // 3. ENFORCE LIMITS
    // Block Free users if they are out of credits. (Pro users bypass this soft limit for now).
    if (user.credits <= 0 && user.plan !== 'pro') {
        return response.status(403).json({ 
            error: 'Out of Energy', 
            details: 'You have used all your Alara Credits. Please top up with Sparks or upgrade to Pro to continue.' 
        });
    }

    const model = 'gemini-2.5-flash'; 
    const apiKey = process.env.GEMINI_API_KEY;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        let requestPayload = request.body;
        if (typeof requestPayload === 'string') requestPayload = JSON.parse(requestPayload);

        // 4. Call Google Gemini API
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
        });

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
            return response.status(geminiResponse.status).json({ 
                error: 'Gemini API Error', 
                details: data.error?.message || 'Unknown error' 
            });
        }

        // 5. CALCULATE COST & DEDUCT CREDITS
        const usage = data.usageMetadata || {};
        const inputTokens = usage.promptTokenCount || 0;
        const outputTokens = usage.candidatesTokenCount || 0;
        
        // 1 Input Token = 1 Credit | 1 Output Token = 8 Credits
        const totalCost = inputTokens + (outputTokens * 8);

        // Deduct from Neon DB
        try {
            await sql`UPDATE users SET credits = GREATEST(credits - ${totalCost}, 0) WHERE id = ${userId}`;
        } catch (dbErr) {
            console.error('Failed to deduct credits:', dbErr);
        }

        return response.status(200).json(data);

    } catch (error) {
        console.error('Internal Error:', error);
        return response.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
