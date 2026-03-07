import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.alara_session;

    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    try {
        // Fetch User and all new limit columns
        const { rows } = await sql`
            SELECT id, name, email, plan, role, credits, plan_expiry, free_images_used, last_reset_date 
            FROM users 
            WHERE id = ${decoded.userId};
        `;
        
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
        
        let user = rows[0];

        // --- 1. PRO EXPIRY CHECK ---
        if (user.plan === 'pro' && user.plan_expiry) {
            const now = new Date();
            const expiry = new Date(user.plan_expiry);
            if (now > expiry) {
                // Pro expired, revert to free
                await sql`UPDATE users SET plan = 'free' WHERE id = ${user.id}`;
                user.plan = 'free';
            }
        }

        // --- 2. DAILY RESET LOGIC (For Free Users) ---
        const today = new Date().toDateString();
        const lastReset = user.last_reset_date ? new Date(user.last_reset_date).toDateString() : '';

        if (today !== lastReset) {
            let newCredits = user.credits;
            
            // If they are on the Free plan, they get reset to EXACTLY 100,000 (It doesn't stack)
            if (user.plan === 'free') {
                newCredits = 100000; 
            } 
            // Note: If they are Pro, or bought Sparks, they keep their current accumulated balance!

            await sql`
                UPDATE users 
                SET last_reset_date = CURRENT_TIMESTAMP, 
                    free_images_used = 0,
                    credits = ${newCredits}
                WHERE id = ${user.id}
            `;
            
            user.free_images_used = 0;
            user.credits = newCredits;
        }

        // Format credits for the frontend UI (e.g., 100,000 instead of 100000)
        user.formattedCredits = user.credits ? user.credits.toLocaleString() : '0';

        return res.status(200).json({ user });

    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({ message: 'Database connection failed' });
    }
}
