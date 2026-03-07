import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  // 1. Auth Check
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.alara_session;
  if (!token) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

  let user;
  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await sql`SELECT id, plan, credits FROM users WHERE id = ${decoded.userId}`;
      user = rows[0];
  } catch (e) {
      return res.status(401).json({ error: 'Invalid session token' });
  }

  // 2. Limit Check (Cost: 25,000 Energy)
  if (user.plan !== 'pro' && user.credits < 25000) {
      return res.status(403).json({ 
          error: 'Not Enough Energy', 
          details: 'Grok-Video generation requires 25,000 Alara Credits. Please top up your Sparks or upgrade to Pro.'
      });
  }

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

  try {
      // 3. Generate Video using native Pollinations GET endpoint
      const encodedPrompt = encodeURIComponent(prompt);
      const url = `https://gen.pollinations.ai/video/${encodedPrompt}?model=grok-video`;

      const response = await fetch(url, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${apiKey}`
          }
      });

      if (!response.ok) {
          const errText = await response.text();
          console.error("Video Gen Error:", errText);
          return res.status(response.status).json({ error: 'Generation failed', details: "Pollinations server is busy or timed out." });
      }

      // Convert binary video stream to Base64 Data URL to bypass frontend Auth/CORS issues
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Video = buffer.toString('base64');
      const dataUrl = `data:video/mp4;base64,${base64Video}`;

      // 4. Deduct 25,000 Credits (Only if successful and not Pro)
      if (user.plan !== 'pro') {
          try {
              await sql`UPDATE users SET credits = GREATEST(credits - 25000, 0) WHERE id = ${user.id}`;
          } catch (dbErr) {
              console.error('Failed to deduct video credits:', dbErr);
          }
      }

      return res.status(200).json({ videoUrl: dataUrl });

  } catch (error) {
      console.error("Critical Video Error:", error);
      return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
