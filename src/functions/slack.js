// Vercel serverless function for Slack
import { App } from '@slack/bolt';
import { getConfig } from '../lib/config.js';
import { initAnnouncementHandlers } from '../handlers/announcement.js';
import { initEditHandlers } from '../handlers/edit.js';

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

// Health check endpoint
app.get('/health', async (req) => {
  return { status: 'ok' };
});

// Vercel serverless function export
export default async function handler(req, res) {
  await app.handler(req, res);
}
