import jwt from 'jsonwebtoken';
import cookie from 'cookie';

export default async function handler(request, response) {
    // 1. Check for the user's session cookie
    const cookies = cookie.parse(request.headers.cookie || '');
    const token = cookies.alara_session;
    let userPlan = 'free'; // Default to free plan

    // 2. If a token exists, verify it to get the user's plan
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userPlan = decoded.plan || 'free';
        } catch (error) {
            // Invalid token, user remains on the free plan
            console.warn("Invalid JWT token received:", error.message);
        }
    }

    // 3. Select the AI model based on your available API key.
    const model = 'gemini-2.5-flash'; 
    console.log(`User plan: '${userPlan}', using model: '${model}'`); // FIXED: Changed backticks in console.log

    // 4. Call the Gemini API with the selected model
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY is missing from environment variables.");
        return response.status(500).json({ error: 'Server configuration error' });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        let requestPayload = request.body;
        if (typeof requestPayload === 'string') {
            requestPayload = JSON.parse(requestPayload);
        }

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
        });

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
            console.error('Gemini API Error:', data);
            return response.status(geminiResponse.status).json({ error: 'Failed to fetch response from Gemini API' });
        }

        return response.status(200).json(data);
    } catch (error) {
        console.error('Internal Server Error:', error);
        return response.status(500).json({ error: 'Internal server error' });
    }
}
