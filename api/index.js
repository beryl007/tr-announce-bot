// Slack Bot - TR Announcement Bot
import { verifySlackRequest } from '@slack/bolt';

let appInstance = null;

async function getApp() {
  if (!appInstance) {
    const { App } = (await import('@slack/bolt')).default;

    appInstance = new App({
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      token: process.env.SLACK_BOT_TOKEN,
    });

    // Import and initialize handlers
    const { initAnnouncementHandlers } = await import('../src/handlers/announcement.js');
    const { initEditHandlers } = await import('../src/handlers/edit.js');

    initAnnouncementHandlers(appInstance);
    initEditHandlers(appInstance);

    console.log('Slack app initialized with handlers');
  }
  return appInstance;
}

export default async function handler(req, res) {
  console.log('Request:', req.method, req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  try {
    const app = await getApp();

    // Vercel parses the body, but Slack Bolt expects raw body for signature verification
    // We need to reconstruct the raw body
    if (req.body && req.method === 'POST') {
      req.rawBody = new URLSearchParams(req.body).toString();
    }

    await app.handler(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack?.substring(0, 500) });
  }
}
