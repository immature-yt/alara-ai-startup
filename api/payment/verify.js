import crypto from 'crypto';
import { sql } from '@vercel/postgres';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';

// We need Razorpay here to securely fetch the order details and prevent hacking
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

  // 1. Verify Signature (Cryptographic Check)
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  if (expectedSignature === razorpay_signature) {
    try {
        // 2. SECURE CHECK: Ask Razorpay exactly how much this order was for
        const order = await razorpay.orders.fetch(razorpay_order_id);
        const amountPaid = order.amount / 100; // Convert back from paise to rupees

        // 3. Grant the specific tier and credits based on the amount paid
        if (amountPaid === 49) {
            // FIRE SPARKS (Top Up): Do not change their plan, just add 200k credits instantly
            await sql`
                UPDATE users 
                SET credits = credits + 200000 
                WHERE id = ${userId}
            `;
        } 
        else if (amountPaid === 249 || amountPaid === 399) {
            // PRO PLAN (Tech Fest Price or Standard)
            await sql`
                UPDATE users 
                SET plan = 'pro', 
                    credits = 5000000, 
                    plan_expiry = CURRENT_TIMESTAMP + INTERVAL '28 days',
                    videos_used_today = 0, 
                    images_used_today = 0 
                WHERE id = ${userId}
            `;
        }
        else if (amountPaid === 1799) {
            // ELITE PLAN
            await sql`
                UPDATE users 
                SET plan = 'elite', 
                    credits = 15000000, 
                    plan_expiry = CURRENT_TIMESTAMP + INTERVAL '28 days',
                    videos_used_today = 0, 
                    images_used_today = 0 
                WHERE id = ${userId}
            `;
        }
        else if (amountPaid === 5400) {
            // LUXURY PLAN
            await sql`
                UPDATE users 
                SET plan = 'luxury', 
                    credits = 40000000, 
                    plan_expiry = CURRENT_TIMESTAMP + INTERVAL '28 days',
                    videos_used_today = 0, 
                    images_used_today = 0 
                WHERE id = ${userId}
            `;
        } else {
             console.error("Unknown amount paid:", amountPaid);
             return res.status(400).json({ error: 'Invalid payment amount detected.' });
        }

        res.status(200).json({ success: true, message: 'Payment verified and plan upgraded!' });
    } catch (error) {
        console.error('Server/DB Error during verification:', error);
        res.status(500).json({ error: 'Database update failed.' });
    }
  } else {
    res.status(400).json({ success: false, error: 'Invalid signature. Payment rejected.' });
  }
}
