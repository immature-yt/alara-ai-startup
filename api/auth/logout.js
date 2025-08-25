import cookie from 'cookie';

export default function handler(req, res) {
    res.setHeader('Set-Cookie', cookie.serialize('alara_session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        expires: new Date(0), // Set expiry to the past
        path: '/',
        sameSite: 'lax',
    }));
    res.redirect(302, '/#home');
}
