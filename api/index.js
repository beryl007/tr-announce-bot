// Slack Bot - TR Announcement Bot
import { App } from '@slack/bolt';
import { initAnnouncementHandlers } from '../src/handlers/announcement.js';
import { initEditHandlers } from '../src/handlers/edit.js';

// Initialize Slack Bolt App
const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

// Initialize all handlers
initAnnouncementHandlers(app);
initEditHandlers(app);

// Request ID tracking for deduplication
const processedRequests = new Map();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [reqId, timestamp] of processedRequests.entries()) {
    if (now - timestamp > 60000) {
      processedRequests.delete(reqId);
    }
  }
}, 30000);

// Vercel serverless function handler
export default async function handler(req, res) {
  console.log('Request:', req.method, req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.json({ status: 'ok', message: 'TR Announcement Bot is running' });
  }

  try {
    // Generate unique request ID for deduplication
    const requestId = `${req.headers['x-slack-request-timestamp']}_${JSON.stringify(req.body).slice(0, 100)}`;

    // Check if we already processed this request
    if (processedRequests.has(requestId)) {
      console.log('Duplicate request, ignoring:', requestId);
      return res.send('');
    }
    processedRequests.set(requestId, Date.now());

    // Use Slack Bolt's built-in handler
    await app.handler(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
