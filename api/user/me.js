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
        // Fetch User and all NEW limit columns
        const { rows } = await sql`
            SELECT id, name, email, plan, role, credits, plan_expiry, videos_used_today, images_used_today, last_reset_date 
            FROM users 
            WHERE id = ${decoded.userId};
        `;
        
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
        
        let user = rows[0];

        // --- 1. 28-DAY PLAN EXPIRY CHECK (For ALL Paid Tiers) ---
        // If they are on any paid plan, check if the 28-day clock ran out
        if (['pro', 'elite', 'luxury'].includes(user.plan) && user.plan_expiry) {
            const now = new Date();
            const expiry = new Date(user.plan_expiry);
            if (now > expiry) {
                // Plan expired, revert to 'free' and wipe the expiry date
                await sql`UPDATE users SET plan = 'free', plan_expiry = NULL WHERE id = ${user.id}`;
                user.plan = 'free';
                user.plan_expiry = null;
            }
        }

        // --- 2. DAILY RESET LOGIC (The Midnight Refresh) ---
        const today = new Date().toDateString();
        const lastReset = user.last_reset_date ? new Date(user.last_reset_date).toDateString() : '';

        if (today !== lastReset) {
            let newCredits = user.credits;
            
            // THE FIRE SPARKS FIX: 
            // If they are Free, only top them up to 100k if they are below it.
            // If they bought Sparks and have 250k, this leaves their balance alone!
            if (user.plan === 'free' && newCredits < 100000) {
                newCredits = 100000; 
            } 

            await sql`
                UPDATE users 
                SET last_reset_date = CURRENT_TIMESTAMP, 
                    videos_used_today = 0,
                    images_used_today = 0,
                    credits = ${newCredits}
                WHERE id = ${user.id}
            `;
            
            user.videos_used_today = 0;
            user.images_used_today = 0;
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
