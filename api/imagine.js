// api/imagine.js
/**
 * Handles POST requests to generate an image URL using Pollinations AI.
 * Expects a JSON body with a 'prompt' field.
 *
 * @param {import('@vercel/node').VercelRequest} req The HTTP request object.
 * @param {import('@vercel/node').VercelResponse} res The HTTP response object.
 */
export default async function handler(req, res) {
  // 1. Ensure the request method is POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt } = req.body;

    // 3. If prompt is missing, return 400
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // 4. Use Pollinations AI for free image generation
    // Added a random seed to ensure uniqueness for repeated prompts
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;

    // 5. Respond with JSON like { imageUrl: "https://image.pollinations.ai/prompt/...." }
    res.status(200).json({ imageUrl });

  } catch (error) {
    // 6. Handle errors gracefully and log them
    console.error('Error in /api/imagine:', error); // Log the detailed error for debugging
    res.status(500).json({ error: 'Image generation failed' });
  }
}
