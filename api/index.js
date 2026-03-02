// Main Slack Bot handler
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

// Export for Vercel
export default async function handler(req, res) {
  await app.handler(req, res);
}
