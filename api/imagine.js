import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  // 1. Authenticate Request
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.alara_session;
  if (!token) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

  let user;
  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await sql`SELECT id, plan, free_images_used FROM users WHERE id = ${decoded.userId}`;
      user = rows[0];
  } catch (e) {
      return res.status(401).json({ error: 'Invalid session token' });
  }

  // 2. ENFORCE IMAGE LIMITS
  // Free users get 5 images per day. Pro users get unlimited.
  if (user.plan !== 'pro' && user.free_images_used >= 5) {
      return res.status(403).json({ 
          error: 'Image Limit Reached', 
          details: 'You have used your 5 free daily images. Upgrade to Pro for unlimited image generation.'
      });
  }

  const encodedPrompt = encodeURIComponent(prompt);
  const apiKey = process.env.POLLINATIONS_API_KEY;

  try {
    if (apiKey) {
        const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&nologo=true`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (response.ok) {
            // Convert to Base64 to bypass CORS/frontend rendering issues
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString('base64');
            const dataUrl = `data:image/jpeg;base64,${base64Image}`;
            
            // 3. Increment usage counter in DB
            try {
                await sql`UPDATE users SET free_images_used = free_images_used + 1 WHERE id = ${user.id}`;
            } catch(dbErr) {
                console.error("Failed to count image usage:", dbErr);
            }

            return res.status(200).json({ imageUrl: dataUrl });
        }
    }

    // Fallback if API fails
    const fallbackUrl = `https://loremflickr.com/800/600/${encodeURIComponent(prompt.split(' ')[0] || 'technology')}?random=${Math.random()}`;
    return res.status(200).json({ imageUrl: fallbackUrl });

  } catch (error) {
    console.error("Image Error:", error.message);
    const placeholder = `https://placehold.co/1024x1024/2d2d2d/FFF?text=${encodedPrompt}`;
    return res.status(200).json({ imageUrl: placeholder });
  }
}
