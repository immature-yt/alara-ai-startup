// This is a Vercel serverless function that acts as a proxy for image generation.
// It receives a prompt, formats it for the Pollinations API, and returns the image.

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = request.body;
    if (!prompt) {
      return response.status(400).json({ error: 'Prompt is required' });
    }

    // Format the prompt for the Pollinations API URL
    const formattedPrompt = encodeURIComponent(prompt.replace(/ /g, "_"));
    const imageUrl = `https://image.pollinations.ai/prompt/${formattedPrompt}`;

    // Return the image URL to the client
    return response.status(200).json({ imageUrl: imageUrl });

  } catch (error) {
    console.error('Internal Server Error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
