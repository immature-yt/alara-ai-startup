import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

export default async function handler(req, res) {
    // 1. Auth Check
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.alara_session;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    let user;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Fetch fresh user data to check plan
        const { rows } = await sql`SELECT id, plan FROM users WHERE id = ${decoded.userId}`;
        user = rows[0];
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // 2. GET: Load All Chats
    if (req.method === 'GET') {
        try {
            const { rows } = await sql`
                SELECT chat_id as id, title, history 
                FROM chats 
                WHERE user_id = ${user.id} 
                ORDER BY last_updated DESC
            `;
            return res.status(200).json({ chats: rows });
        } catch (e) {
            return res.status(500).json({ error: 'Failed to load chats' });
        }
    }

    // 3. POST: Save/Update a Chat
    if (req.method === 'POST') {
        const { id, title, history } = req.body;
        
        // LIMIT CHECK FOR FREE TIER
        const isPro = (user.plan || 'free').toLowerCase().trim() === 'pro';
        const LIMIT = isPro ? 1000 : 10; // 10 Chats for Free, 1000 for Pro

        try {
            // Check count only if inserting a NEW chat (not updating existing)
            const { rows: existing } = await sql`SELECT chat_id FROM chats WHERE chat_id = ${id}`;
            
            if (existing.length === 0) {
                const { rows: count } = await sql`SELECT COUNT(*) FROM chats WHERE user_id = ${user.id}`;
                if (parseInt(count[0].count) >= LIMIT) {
                    return res.status(403).json({ error: 'Storage Limit Reached', limit: LIMIT, isPro });
                }
            }

            // Upsert (Insert or Update)
            await sql`
                INSERT INTO chats (chat_id, user_id, title, history, last_updated)
                VALUES (${id}, ${user.id}, ${title}, ${JSON.stringify(history)}, NOW())
                ON CONFLICT (chat_id) 
                DO UPDATE SET title = ${title}, history = ${JSON.stringify(history)}, last_updated = NOW();
            `;
            return res.status(200).json({ success: true });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Failed to save chat' });
        }
    }

    // 4. DELETE: Remove a Chat
    if (req.method === 'DELETE') {
        const { id } = req.query;
        try {
            await sql`DELETE FROM chats WHERE chat_id = ${id} AND user_id = ${user.id}`;
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Failed to delete' });
        }
    }
}
