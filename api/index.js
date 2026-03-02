// Test different import methods
export default async function handler(req, res) {
  console.log('Testing import methods...');

  try {
    // Method 1: Named import
    const mod1 = await import('@slack/bolt');
    console.log('Module keys:', Object.keys(mod1));
    console.log('Has App?', 'App' in mod1);
    console.log('Has default?', 'default' in mod1);
    console.log('App type:', typeof mod1.App);
    console.log('default type:', typeof mod1.default);

    res.json({
      status: 'ok',
      moduleKeys: Object.keys(mod1),
      hasApp: 'App' in mod1,
      hasDefault: 'default' in mod1,
      appType: typeof mod1.App,
      defaultType: typeof mod1.default
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
  }
}
