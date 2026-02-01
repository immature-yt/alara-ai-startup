import crypto from 'crypto';
import { sql } from '@vercel/postgres';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.alara_session;
  
  if (!token) return res.status(401).json({ error: 'Session expired.' });

  let userId;
  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
  } catch (e) {
      return res.status(401).json({ error: 'Invalid token.' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Verify Signature
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  if (expectedSignature === razorpay_signature) {
    try {
        // Update User Plan in Neon DB
        await sql`UPDATE users SET plan = 'pro' WHERE id = ${userId}`;
        res.status(200).json({ success: true });
    } catch (dbError) {
        console.error('DB Error:', dbError);
        res.status(500).json({ error: 'Database update failed.' });
    }
  } else {
    res.status(400).json({ success: false, error: 'Invalid signature.' });
  }
}
