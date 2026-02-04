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

  const encodedPrompt = encodeURIComponent(prompt);
  const apiKey = process.env.POLLINATIONS_API_KEY;

  try {
    // STRATEGY 1: Official Authenticated Pollinations API
    // Endpoint: https://gen.pollinations.ai/image/{prompt}
    // Auth: Bearer Token
    // We fetch the binary image data on the server to avoid CORS/Redirects issues on the client.
    
    if (apiKey) {
        // Using 'flux' as per docs. Adding 'nologo=true' to keep it professional.
        const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&nologo=true`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (response.ok) {
            // Convert binary image to Base64 Data URL
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString('base64');
            const dataUrl = `data:image/jpeg;base64,${base64Image}`;
            
            return res.status(200).json({ imageUrl: dataUrl });
        } else {
            console.warn(`Pollinations API Error: ${response.status} ${response.statusText}`);
        }
    } else {
        console.warn("Skipping Pollinations: No API Key found.");
    }

    // STRATEGY 2: Visual Fallback (LoremFlickr)
    // If the API fails (e.g., out of Pollen) or key is missing, return a relevant stock photo.
    // This ensures your demo NEVER shows a broken image or error text.
    const keyword = prompt.split(' ')[0] || 'technology';
    const fallbackUrl = `https://loremflickr.com/800/600/${encodeURIComponent(keyword)}?random=${Math.random()}`;
    
    return res.status(200).json({ imageUrl: fallbackUrl });

  } catch (error) {
    console.error("Critical Image Error:", error.message);
    
    // STRATEGY 3: Last Resort Text Placeholder
    const placeholder = `https://placehold.co/1024x1024/2d2d2d/FFF?text=${encodedPrompt}`;
    return res.status(200).json({ imageUrl: placeholder });
  }
}
