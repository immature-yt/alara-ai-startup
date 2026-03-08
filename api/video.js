import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

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

  // Cost: 25,000 Energy
  if (user.plan !== 'pro' && user.credits < 25000) {
      return res.status(403).json({ 
          error: 'Not Enough Energy', 
          details: 'Grok-Video generation requires 25,000 Alara Credits. Please top up your Sparks or upgrade to Pro.'
      });
  }

  try {
      // Deduct 25,000 Credits (Only if not Pro)
      if (user.plan !== 'pro') {
          await sql`UPDATE users SET credits = GREATEST(credits - 25000, 0) WHERE id = ${user.id}`;
      }

      // Return the Stealth Proxy URL (Tiny string, zero token bloat!)
      const proxyUrl = `/api/media?type=video&q=${encodeURIComponent(prompt)}`;
      return res.status(200).json({ videoUrl: proxyUrl });

  } catch (error) {
      console.error("Critical Video DB Error:", error);
      return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
