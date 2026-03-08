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
      const { rows } = await sql`SELECT id, plan, free_images_used FROM users WHERE id = ${decoded.userId}`;
      user = rows[0];
  } catch (e) {
      return res.status(401).json({ error: 'Invalid session token' });
  }

  if (user.plan !== 'pro' && user.free_images_used >= 5) {
      return res.status(403).json({ 
          error: 'Image Limit Reached', 
          details: 'You have used your 5 free daily images. Upgrade to Pro for unlimited image generation.'
      });
  }

  try {
      if (user.plan !== 'pro') {
          await sql`UPDATE users SET free_images_used = free_images_used + 1 WHERE id = ${user.id}`;
      }

      // Return the Stealth Proxy URL
      const proxyUrl = `/api/media?type=image&q=${encodeURIComponent(prompt)}`;
      return res.status(200).json({ imageUrl: proxyUrl });

  } catch (error) {
      console.error("Image DB Error:", error);
      return res.status(500).json({ error: 'Internal Server Error' });
  }
}
