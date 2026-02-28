/**
 * Configuration management
 * Reads from environment variables
 */

export function getConfig() {
  const requiredEnvVars = [
    'SLACK_SIGNING_SECRET',
    'SLACK_BOT_TOKEN',
    'SLACK_CLIENT_ID',
    'SLACK_CLIENT_SECRET',
    'ZHIPU_API_KEY'
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn('Warning: Missing environment variables:', missing.join(', '));
  }

  return {
    // Slack Configuration
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
    slackBotToken: process.env.SLACK_BOT_TOKEN || '',
    slackClientId: process.env.SLACK_CLIENT_ID || '',
    slackClientSecret: process.env.SLACK_CLIENT_SECRET || '',
    slackStateSecret: process.env.SLACK_STATE_SECRET || 'teon-announce-bot-secret',
    slackRedirectUri: process.env.SLACK_REDIRECT_URI || '',

    // Zhipu GLM Configuration
    zhipuApiKey: process.env.ZHIPU_API_KEY || '',
    zhipuModel: process.env.ZHIPU_MODEL || 'glm-4-flash',

    // Game Configuration
    gameName: process.env.GAME_NAME || 'Teon: Revelation',
    serverTimezone: process.env.SERVER_TIMEZONE || 'UTC+8',
    serverTimezoneLabel: process.env.SERVER_TIMEZONE_LABEL || '(UTC+8)',

    // Environment
    isDevelopment: process.env.NODE_ENV !== 'production',
    baseUrl: process.env.BASE_URL || ''
  };
}
