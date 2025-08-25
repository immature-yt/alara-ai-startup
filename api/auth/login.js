import { OAuth2Client } from 'google-auth-library';

export default async function handler(req, res) {
    const redirectURI = `${process.env.APP_BASE_URL}/api/auth/callback/google`;

    const oAuth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectURI
    );

    const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
        ],
        prompt: 'consent'
    });

    res.redirect(302, authorizeUrl);
}
