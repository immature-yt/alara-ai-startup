import jwt from 'jsonwebtoken';
import cookie from 'cookie';
// Placeholder for your database client
// import { sql } from '@vercel/postgres';

async function db_getUserById(userId) {
    // Replace with your actual database call
    // const { rows } = await sql`SELECT id, name, email, plan, role FROM users WHERE id = ${userId};`;
    // return rows.length > 0 ? rows[0] : null;

    // --- TEMPORARY MOCK DATA (Remove when DB is connected) ---
     return {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        plan: 'free',
        role: 'user'
    };
}


export default async function handler(req, res) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.alara_session;

    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await db_getUserById(decoded.userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user });
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
}
