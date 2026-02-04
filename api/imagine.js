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

  // Clean the prompt for URLs
  const encodedPrompt = encodeURIComponent(prompt);

  try {
    // ---------------------------------------------------------
    // STRATEGY 1: Lexica.art (Best for Demos)
    // Searches a massive DB of high-quality Stable Diffusion images.
    // ---------------------------------------------------------
    try {
        const lexicaRes = await fetch(`https://lexica.art/api/v1/search?q=${encodedPrompt}`);
        
        if (lexicaRes.ok) {
            const lexicaData = await lexicaRes.json();
            if (lexicaData.images && lexicaData.images.length > 0) {
                // Return a random image from the top 5 results for variety
                const randomIndex = Math.floor(Math.random() * Math.min(5, lexicaData.images.length));
                return res.status(200).json({ imageUrl: lexicaData.images[randomIndex].src });
            }
        }
    } catch (e) {
        console.warn("Lexica search failed, trying fallback...", e.message);
    }

    // ---------------------------------------------------------
    // STRATEGY 2: Pollinations AI (Live Generation)
    // We try the 'flux' model which is often more stable than default
    // ---------------------------------------------------------
    try {
        const seed = Math.floor(Math.random() * 1000000);
        // Using 'flux' model explicitly and removing complex params to reduce 502 chance
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=flux`;

        // Check if the image is actually generating (Head request)
        const check = await fetch(pollinationsUrl, { method: 'HEAD', signal: AbortSignal.timeout(3500) });
        
        if (check.ok) {
            return res.status(200).json({ imageUrl: pollinationsUrl });
        }
    } catch (e) {
        console.warn("Pollinations failed:", e.message);
    }

    // ---------------------------------------------------------
    // STRATEGY 3: Visual Fallback (LoremFlickr)
    // Instead of text, return a real stock photo matching the keywords.
    // Much better for a live presentation than an error message.
    // ---------------------------------------------------------
    // Extract the first valid keyword from prompt or default to 'technology'
    const keyword = prompt.split(' ')[0] || 'technology';
    const fallbackUrl = `https://loremflickr.com/800/600/${encodeURIComponent(keyword)}?random=${Math.random()}`;
    
    return res.status(200).json({ imageUrl: fallbackUrl });

  } catch (error) {
    console.error("Critical Image Error:", error.message);
    // Absolute last resort: The text placeholder
    const placeholder = `https://placehold.co/1024x1024/2d2d2d/FFF?text=${encodedPrompt}`;
    return res.status(200).json({ imageUrl: placeholder });
  }
}
