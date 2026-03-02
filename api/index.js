// Import Slack Bolt
import { App } from '@slack/bolt';

export default function handler(req, res) {
  console.log('Request:', req.method, req.url);

  // Create a test app instance
  try {
    const testApp = new App({
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      token: process.env.SLACK_BOT_TOKEN,
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      stateSecret: process.env.SLACK_STATE_SECRET,
    });

    res.json({
      status: 'ok',
      message: 'Slack Bolt initialized successfully',
      appCreated: true
    });
  } catch (error) {
    console.error('Error creating app:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack
    });
  }
}
