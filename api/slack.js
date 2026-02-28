// Vercel serverless function for Slack OAuth callback
export default async function handler(req, res) {
  console.log('Request:', req.method, req.url);

  // Handle OAuth callback
  if (req.url?.includes('/slack/oauth')) {
    const { code, state } = req.query || {};

    if (code) {
      // OAuth callback received
      console.log('OAuth code received:', code);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>安装成功</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            h1 { color: #4a5568; margin-bottom: 20px; }
            p { color: #718096; }
            .code {
              background: #f7fafc;
              padding: 10px;
              border-radius: 6px;
              font-family: monospace;
              color: #2d3748;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✅ 安装成功！</h1>
            <p>TR Announcement Bot 已成功安装到你的 Workspace</p>
            <p>你现在可以关闭此页面并返回 Slack 使用 /announce 命令</p>
          </div>
        </body>
        </html>
      `);
    }
  }

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.status(200).end();
  }

  // Default response
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'ok', message: 'TR Announcement Bot API is running' });
}
