// Slack OAuth handler
export default async function handler(req, res) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(`<h1>安装被取消</h1><p>错误: ${error}</p>`);
  }

  if (code) {
    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>安装成功 - TR Announcement Bot</title>
          <meta charset="utf-8">
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
            .success-icon { font-size: 60px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success-icon">✅</div>
            <h1>安装成功！</h1>
            <p>TR Announcement Bot 已成功安装</p>
            <p>在 Slack 中输入 <b>/announce</b> 开始使用</p>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch (err) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(`<h1>安装失败</h1><p>错误: ${err.message}</p>`);
    }
  }

  res.json({ status: 'ok' });
}
