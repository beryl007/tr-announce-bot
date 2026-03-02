// Test default export properties
export default async function handler(req, res) {
  console.log('Testing default export...');

  try {
    const mod = await import('@slack/bolt');
    const def = mod.default;

    console.log('Default export keys:', Object.keys(def));
    console.log('Has App in default?', 'App' in def);

    res.json({
      status: 'ok',
      defaultKeys: Object.keys(def),
      hasAppInDefault: 'App' in def,
      defaultType: typeof def
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}
