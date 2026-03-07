import Razorpay from 'razorpay';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

// Initialize Razorpay
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
      // 2. Get Amount from Frontend (Default to 399 if missing)
      const { amount = 399 } = req.body;
      
      // Amount is in "paise" (smallest currency unit). Multiply by 100.
      const amountInPaise = amount * 100;

      const options = {
          amount: amountInPaise, 
          currency: "INR",
          receipt: "order_rcptid_" + Date.now(),
          payment_capture: 1
      };

      const order = await razorpay.orders.create(options);
      
      // Send order ID and key to frontend
      res.status(200).json({
          ...order,
          key: process.env.RAZORPAY_KEY_ID
      });
      
  } catch (error) {
      console.error('Razorpay Error:', error);
      res.status(500).json({ error: 'Could not create order.' });
  }
}
