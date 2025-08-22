// This is a Vercel serverless function for image generation.
// It receives a prompt from the user's browser,
// securely adds the secret API key, and calls the Imagen API.

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

    const payload = {
      instances: [{ prompt: prompt }],
      parameters: { "sampleCount": 1 }
    };

    const imageResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!imageResponse.ok) {
      const errorData = await imageResponse.json();
      console.error('Imagen API Error:', errorData);
      return new Response(JSON.stringify({ error: 'Failed to generate image from API' }), { status: imageResponse.status });
    }

    const data = await imageResponse.json();
    
    // Send the successful response back to the user's browser.
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Internal Server Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
