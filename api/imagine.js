export default async function handler(req, res) {
  // 1. Ensure the request method is POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body;
  // 2. If prompt is missing, return 400
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Clean the prompt
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 1000000);

  try {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    
    // STRATEGY: Pollinations AI (Authenticated)
    // Uses your API Key to guarantee generation (No 502s, No Redirects).
    if (apiKey) {
        try {
            const response = await fetch('https://image.pollinations.ai/openai/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'flux', // High quality, lower cost than flux-pro
                    prompt: prompt,
                    n: 1,
                    size: '1024x1024',
                    seed: seed
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data[0] && data.data[0].url) {
                    return res.status(200).json({ imageUrl: data.data[0].url });
                }
            } else {
                console.warn("Pollinations Auth API failed:", response.status, response.statusText);
                // Continue to URL construction if API call fails
            }
        } catch (e) {
            console.error("Pollinations API error:", e.message);
        }
    }
