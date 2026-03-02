// Test endpoint
export default function handler(req, res) {
  res.json({
    message: 'API is working',
    method: req.method,
    url: req.url,
    headers: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
}
