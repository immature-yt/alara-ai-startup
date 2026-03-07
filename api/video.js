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
      // 3. Generate Video using OpenAI compatible endpoint (Returns URL directly)
      const response = await fetch('https://image.pollinations.ai/openai/images/generations', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
              model: 'grok-video',
              prompt: prompt,
              n: 1
          })
      });

      if (!response.ok) {
          const errText = await response.text();
          console.error("Video Gen Error:", errText);
          return res.status(response.status).json({ error: 'Generation failed', details: "Pollinations server is busy." });
      }

      const data = await response.json();
      
      if (data.data && data.data[0] && data.data[0].url) {
          const videoUrl = data.data[0].url;

          // 4. Deduct 25,000 Credits (Only if successful and not Pro)
          if (user.plan !== 'pro') {
              try {
                  await sql`UPDATE users SET credits = GREATEST(credits - 25000, 0) WHERE id = ${user.id}`;
              } catch (dbErr) {
                  console.error('Failed to deduct video credits:', dbErr);
              }
          }

          return res.status(200).json({ videoUrl });
      } else {
          return res.status(500).json({ error: 'Failed to extract video URL' });
      }

  } catch (error) {
      console.error("Critical Video Error:", error);
      return res.status(500).json({ error: 'Internal Server Error' });
  }
}
