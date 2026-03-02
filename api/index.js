// Simple test - check if basic imports work
export default function handler(req, res) {
  console.log('Request:', req.method, req.url);
  console.log('Env vars:', {
    hasSigningSecret: !!process.env.SLACK_SIGNING_SECRET,
    hasBotToken: !!process.env.SLACK_BOT_TOKEN,
    hasClientId: !!process.env.SLACK_CLIENT_ID,
    hasClientSecret: !!process.env.SLACK_CLIENT_SECRET,
    hasStateSecret: !!process.env.SLACK_STATE_SECRET,
    hasRedirectUri: !!process.env.SLACK_REDIRECT_URI,
    hasZhipuKey: !!process.env.ZHIPU_API_KEY
  });

  res.json({
    status: 'ok',
    message: 'Basic handler working',
    envCheck: {
      hasSigningSecret: !!process.env.SLACK_SIGNING_SECRET,
      hasBotToken: !!process.env.SLACK_BOT_TOKEN
    }
  });
}
