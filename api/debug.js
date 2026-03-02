// Debug endpoint to see request details
export default async function handler(req, res) {
  console.log('=== Debug Request ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body type:', typeof req.body);
  console.log('Body:', req.body);

  res.json({
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
    },
    hasBody: !!req.body,
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : null
  });
}
