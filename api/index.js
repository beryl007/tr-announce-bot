// Slack Bot - TR Announcement Bot
import crypto from 'crypto';

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

// Verify Slack request signature
function verifySlackRequest(body, signature, timestamp) {
  const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
  const baseString = `v0:${timestamp}:${body}`;
  hmac.update(baseString);
  const digest = `v0=${hmac.digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
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

  // Only handle POST requests
  if (req.method !== 'POST') {
    return res.json({ status: 'ok', message: 'TR Announcement Bot is running' });
  }

  try {
    const app = await getApp();

    // Get request details
    const body = req.body;
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];

    // Verify request is from Slack
    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Check timestamp (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return res.status(401).json({ error: 'Request too old' });
    }

    // Verify signature
    const rawBody = new URLSearchParams(body).toString();
    if (!verifySlackRequest(rawBody, signature, timestamp)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Handle slash command
    if (body.command === '/announce') {
      // Open modal BEFORE responding
      const { buildTypeSelectionModal } = await import('../src/lib/slack.js');
      await app.client.views.open({
        trigger_id: body.trigger_id,
        view: buildTypeSelectionModal()
      });

      // Then respond with empty string (required for slash commands)
      return res.send('');
    }

    // For URL verification and other requests
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // For other requests (actions, views, etc.)
    await app.receiver.requestListener(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
