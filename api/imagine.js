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

  // Define this at the top so it's available for all strategies
  const encodedPrompt = encodeURIComponent(prompt);

  try {
    // STRATEGY 1: Lexica.art (Primary for Demo - High Reliability)
    // Searches a massive DB of high-quality AI images. 
    // This avoids the 502 errors from live generation services during demos.
    try {
        const lexicaRes = await fetch(`https://lexica.art/api/v1/search?q=${encodedPrompt}`);
        const lexicaData = await lexicaRes.json();

        if (lexicaData.images && lexicaData.images.length > 0) {
            // Pick a random image from the top 5 to keep it feeling "fresh"
            const randomIndex = Math.floor(Math.random() * Math.min(5, lexicaData.images.length));
            return res.status(200).json({ imageUrl: lexicaData.images[randomIndex].src });
        }
    } catch (e) {
        console.warn("Lexica search failed, trying fallback...", e);
    }

    // STRATEGY 2: Pollinations AI (Fallback)
    // Runs if Lexica finds nothing.
    const seed = Math.floor(Math.random() * 1000000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;

    // Quick health check (timeout 3s)
    const check = await fetch(pollinationsUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    if (check.ok) {
        return res.status(200).json({ imageUrl: pollinationsUrl });
    }
    
    throw new Error("All image services unreachable");

  } catch (error) {
    console.error("Image generation failed:", error.message);
    
    // STRATEGY 3: Last Resort Placeholder
    // Ensures the UI never breaks during your presentation
    const placeholder = `https://placehold.co/1024x1024/2d2d2d/FFF?text=${encodedPrompt}`;
    return res.status(200).json({ imageUrl: placeholder });
  }
}
