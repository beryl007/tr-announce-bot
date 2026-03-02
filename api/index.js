// Dynamic import for Slack Bolt
let appInstance = null;

async function getApp() {
  if (!appInstance) {
    const { App } = await import('@slack/bolt');
    appInstance = new App({
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      token: process.env.SLACK_BOT_TOKEN,
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      stateSecret: process.env.SLACK_STATE_SECRET,
    });
  }
  return appInstance;
}

export default async function handler(req, res) {
  console.log('Request:', req.method, req.url);

  try {
    const app = await getApp();
    res.json({
      status: 'ok',
      message: 'Slack Bolt lazy initialized',
      hasApp: !!app
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack?.substring(0, 300)
    });
  }
}
