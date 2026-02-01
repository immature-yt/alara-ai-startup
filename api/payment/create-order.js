import Razorpay from 'razorpay';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

// Initialize Razorpay
// Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are in Vercel Env Vars
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Verify User is Logged In
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.alara_session;
  
  if (!token) {
      return res.status(401).json({ error: 'Please log in to purchase.' });
  }

  try {
      // 2. Create Order
      // Amount is in "paise" (smallest currency unit). 
      // ₹10 = 1000 paise.
      const options = {
          amount: 1000,  // Changed to ₹10 for Pro Plan testing
          currency: "INR",
          receipt: "order_rcptid_" + Date.now(),
          payment_capture: 1
      };

      const order = await razorpay.orders.create(options);
      
      // Send order ID to frontend
      res.status(200).json(order);
      
  } catch (error) {
      console.error('Razorpay Error:', error);
      res.status(500).json({ error: 'Could not create order.' });
  }
}
