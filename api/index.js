// Main Slack Bot handler for Vercel
import { App } from '@slack/bolt';
import { getConfig } from '../src/lib/config.js';
import { initAnnouncementHandlers } from '../src/handlers/announcement.js';
import { initEditHandlers } from '../src/handlers/edit.js';

// Get config
const config = getConfig();

// Initialize Slack Bolt App
const app = new App({
  signingSecret: config.slackSigningSecret,
  token: config.slackBotToken,
  clientId: config.slackClientId,
  clientSecret: config.slackClientSecret,
  stateSecret: config.slackStateSecret,
  scopes: ['commands', 'chat:write', 'chat:write.public', 'im:write', 'files:write'],
  installerOptions: {
    redirectURI: config.slackRedirectUri
  }
});

// Initialize handlers
initAnnouncementHandlers(app);
initEditHandlers(app);

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Export for Vercel - handle the request properly
export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  try {
    await app.handler(req, res);
  } catch (error) {
    console.error('Slack handler error:', error);
    res.status(500).json({ error: error.message });
  }
}
