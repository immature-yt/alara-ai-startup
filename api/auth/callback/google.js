import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
// You'll need a way to connect to your database.
// This is a placeholder for your actual database client setup.
// Example for Vercel Postgres: import { sql } from '@vercel/postgres';

async function db_getOrCreateUser({ google_id, email, name }) {
    // This is placeholder logic. Replace with your actual database calls.
    console.log("DATABASE: Looking for user with google_id:", google_id);
    
    // 1. Check if user exists
    // const { rows } = await sql`SELECT * FROM users WHERE google_id = ${google_id};`;
    // if (rows.length > 0) {
    //     console.log("DATABASE: User found.");
    //     return rows[0];
    // }

    // 2. If not, create user
    // console.log("DATABASE: Creating new user.");
    // const { rows: newRows } = await sql`
    //     INSERT INTO users (google_id, email, name)
    //     VALUES (${google_id}, ${email}, ${name})
    //     RETURNING *;
    // `;
    // return newRows[0];

    // --- TEMPORARY MOCK DATA (Remove when DB is connected) ---
    return {
        id: 1,
        google_id: google_id,
        email: email,
        name: name,
        plan: 'free',
        role: 'user'
    };
}


export default async function handler(req, res) {
    const redirectURI = `${process.env.APP_BASE_URL}/api/auth/callback/google`;
    const oAuth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectURI
    );

    try {
        const { code } = req.query;
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        
        const ticket = await oAuth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        
        const userProfile = {
            google_id: payload.sub,
            email: payload.email,
            name: payload.name,
        };
        
        const user = await db_getOrCreateUser(userProfile);

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, plan: user.plan },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.setHeader('Set-Cookie', cookie.serialize('alara_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
            sameSite: 'lax',
        }));

        res.redirect(302, '/#chat');

    } catch (error) {
        console.error('Authentication error:', error);
        res.redirect(302, '/#home?error=auth_failed');
    }
}
