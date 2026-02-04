export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    // STRATEGY 1: Lexica.art (Primary for Demo)
    // Searches a massive DB of high-quality AI images. 
    // Faster and more reliable than live generation for presentations.
    const lexicaRes = await fetch(`https://lexica.art/api/v1/search?q=${encodedPrompt}`);
    const lexicaData = await lexicaRes.json();

    if (lexicaData.images && lexicaData.images.length > 0) {
        // Pick a random image from the top 5 to keep it feeling "fresh" and "generative"
        // avoiding the exact same image every time you type the prompt.
        const randomIndex = Math.floor(Math.random() * Math.min(5, lexicaData.images.length));
        return res.status(200).json({ imageUrl: lexicaData.images[randomIndex].src });
    }

    // STRATEGY 2: Pollinations AI (Fallback)
    // Only runs if Lexica finds nothing (rare)
    const seed = Math.floor(Math.random() * 1000000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;

    // Quick health check
    const check = await fetch(pollinationsUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    if (check.ok) {
        return res.status(200).json({ imageUrl: pollinationsUrl });
    }
    
    throw new Error("All image services down");

  } catch (error) {
    console.error("Image generation failed:", error.message);
    
    // STRATEGY 3: Last Resort Placeholder
    // Ensures the UI never breaks during your presentation
    const placeholder = `https://placehold.co/1024x1024/2d2d2d/FFF?text=${encodedPrompt}`;
    return res.status(200).json({ imageUrl: placeholder });
  }
}
