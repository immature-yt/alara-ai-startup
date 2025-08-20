// This is a Vercel serverless function that streams the AI's response.
// It receives the chat history, securely adds the API key,
// and calls the Gemini API's streaming endpoint.

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  // Use the streaming endpoint for Gemini Flash
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:streamGenerateContent?key=${apiKey}`;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const requestPayload = await request.json();

    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!geminiResponse.ok) {
        const errorData = await geminiResponse.json();
        console.error('Gemini API Error:', errorData);
        return new Response(JSON.stringify({ error: 'Failed to fetch response from Gemini API' }), { status: geminiResponse.status });
    }
    
    // Return the streaming response directly to the client
    return new Response(geminiResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });

  } catch (error) {
    console.error('Internal Server Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
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
