// This is a Vercel serverless function that acts as a secure proxy.
// It receives the chat history from the user's browser,
// securely adds the secret API key, and then calls the Gemini API.

export default async function handler(request, response) {
  // Vercel automatically makes environment variables available here.
  const apiKey = process.env.GEMINI_API_KEY;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // FIXED: This robustly handles potential inconsistencies from mobile browsers.
    // It checks if the body is already a string and parses it, ensuring the
    // payload sent to the Gemini API is always correctly formatted.
    let requestPayload = request.body;
    if (typeof requestPayload === 'string') {
        try {
            requestPayload = JSON.parse(requestPayload);
        } catch (e) {
            console.error("Failed to parse request body string:", e);
            return response.status(400).json({ error: "Invalid JSON in request body." });
        }
    }

    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
        console.error('Gemini API Error:', data);
        return response.status(geminiResponse.status).json({ error: 'Failed to fetch response from Gemini API' });
    }

    // Send the successful response back to the user's browser.
    return response.status(200).json(data);

  } catch (error) {
    console.error('Internal Server Error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
