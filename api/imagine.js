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

    // STRATEGY: Pollinations AI (URL Construction)
    // Fallback if no key is present or if API failed. 
    // Using '/p/' path for better stability as seen in docs.
    const pollinationsUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
    
    return res.status(200).json({ imageUrl: pollinationsUrl });

  } catch (error) {
    console.error("Critical Image Error:", error.message);
    // Simple text placeholder if everything explodes, just to keep UI from crashing
    const placeholder = `https://placehold.co/1024x1024/2d2d2d/FFF?text=${encodedPrompt}`;
    return res.status(200).json({ imageUrl: placeholder });
  }
}
