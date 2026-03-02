// Slack OAuth handler
export default async function handler(req, res) {
  // Parse URL and query parameters
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // Handle OAuth callback
  if (code) {
    try {
      // Exchange code for tokens
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          redirect_uri: process.env.SLACK_REDIRECT_URI,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'OAuth failed');
      }

      // Success! Display installation success page
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>安装成功 - TR Announcement Bot</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #4a5568; margin-bottom: 20px; }
            p { color: #718096; line-height: 1.6; }
            .success-icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            .token-info {
              background: #f7fafc;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
              font-size: 12px;
            }
            .token-info strong { display: block; margin-bottom: 5px; color: #2d3748; }
            .token-info code {
              display: block;
              background: white;
              padding: 8px;
              border-radius: 4px;
              color: #5a67d8;
              word-break: break-all;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success-icon">✅</div>
            <h1>安装成功！</h1>
            <p>TR Announcement Bot 已成功安装到你的 Workspace</p>

            <div class="token-info">
              <strong>Bot User OAuth Token (请复制此 Token)</strong>
              <code>${data.access_token || 'N/A'}</code>
            </div>

            <p><strong>下一步：</strong></p>
            <ol style="text-align: left; color: #718096;">
              <li>复制上面的 <code>Bot User OAuth Token</code></li>
              <li>去 Vercel 项目 → Settings → Environment Variables</li>
              <li>添加变量：<code>SLACK_BOT_TOKEN</code> = 你的 Token</li>
              <li>点击 Redeploy</li>
              <li>在 Slack 中输入 <code>/announce</code> 测试</li>
            </ol>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch (err) {
      console.error('OAuth error:', err);
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>安装失败</title>
          <meta charset="utf-8">
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1 class="error">安装失败</h1>
          <p>错误: ${err.message}</p>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(errorHtml);
    }
  }

  // Handle OAuth error
  if (error) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(`<h1>安装被取消</h1><p>错误: ${error}</p>`);
  }

  // Default response
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ endpoint: 'slack', message: 'OAuth endpoint ready' });
}
