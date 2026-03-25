export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
  
    const { type, q } = req.query;
    if (!type || !q) return res.status(400).send('Missing parameters');
  
    const apiKey = process.env.POLLINATIONS_API_KEY;
    const encodedPrompt = encodeURIComponent(q);
  
    let targetUrl = '';
    if (type === 'video') {
      targetUrl = `https://gen.pollinations.ai/video/${encodedPrompt}?model=ltx-2&duration=6&enhance=true`;
    } else {
      targetUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&nologo=true`;
    }
  
    try {
      // Fetch media from Pollinations
      // THE FIX: Attach the VIP wristband (API Key) to EVERYTHING, including images!
      const response = await fetch(targetUrl, {
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
      });
  
      if (!response.ok) return res.status(response.status).send('Media fetch failed');
  
      // Copy the content type (e.g., video/mp4 or image/jpeg)
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
  
      // Set caching headers so it doesn't re-generate every time they refresh
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  
      // Stream the raw binary buffer directly to the user's browser 
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
  
    } catch (error) {
      console.error("Proxy Error:", error);
      res.status(500).send('Internal Proxy Error');
    }
  }
