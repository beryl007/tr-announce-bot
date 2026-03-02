// Slack Bot - TR Announcement Bot
import crypto from 'crypto';

let appInstance = null;

async function getApp() {
  if (!appInstance) {
    const { App } = (await import('@slack/bolt')).default;

    appInstance = new App({
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      token: process.env.SLACK_BOT_TOKEN,
    });

    // Import and initialize handlers
    const { initAnnouncementHandlers } = await import('../src/handlers/announcement.js');
    const { initEditHandlers } = await import('../src/handlers/edit.js');

    initAnnouncementHandlers(appInstance);
    initEditHandlers(appInstance);

    console.log('Slack app initialized with handlers');
  }
  return appInstance;
}

export default async function handler(req, res) {
  console.log('Request:', req.method, req.url, 'Body type:', req.body?.type);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Only handle POST requests
  if (req.method !== 'POST') {
    return res.json({ status: 'ok', message: 'TR Announcement Bot is running' });
  }

  try {
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];

    // Verify request is from Slack
    if (!signature || !timestamp) {
      console.log('Missing signature or timestamp');
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Check timestamp (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      console.log('Request too old');
      return res.status(401).json({ error: 'Request too old' });
    }

    // Verify signature using the parsed body
    // For interactive components, Slack sends the request as application/x-www-form-urlencoded
    // with the actual JSON in a "payload" parameter
    let bodyToVerify = req.body;
    let actualBody = req.body;

    if (req.body.payload) {
      // For interactive components, the signature is based on the url-encoded payload string
      // We need to reconstruct it: payload=<url_encoded_json>
      const payloadObj = req.body.payload;

      // Build the raw string that Slack signed
      // The payload value should be the JSON string, not URL-encoded again
      const payloadJsonString = JSON.stringify(payloadObj);
      const urlEncodedPayload = encodeURIComponent(payloadJsonString);
      bodyToVerify = `payload=${urlEncodedPayload}`;
      actualBody = payloadObj;
    } else if (req.body.command) {
      // For slash commands, the body is url-encoded form data
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(req.body)) {
        params.set(key, value);
      }
      bodyToVerify = params.toString();
    } else {
      // For other requests (view_submission, etc.)
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'object') {
          params.set(key, JSON.stringify(value));
        } else {
          params.set(key, value);
        }
      }
      bodyToVerify = params.toString();
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
    const baseString = `v0:${timestamp}:${bodyToVerify}`;
    hmac.update(baseString);
    const digest = `v0=${hmac.digest('hex')}`;

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
      console.log('Invalid signature');
      console.log('Expected:', digest);
      console.log('Got:', signature);
      console.log('Body to verify (first 200):', bodyToVerify.substring(0, 200));
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const app = await getApp();
    const b = actualBody;

    // Handle URL verification
    if (b.type === 'url_verification') {
      return res.json({ challenge: b.challenge });
    }

    // Handle slash command
    if (b.command === '/announce') {
      const { buildTypeSelectionModal } = await import('../src/lib/slack.js');
      await app.client.views.open({
        trigger_id: b.trigger_id,
        view: buildTypeSelectionModal()
      });
      return res.send('');
    }

    // Handle actions (button clicks)
    if (b.type === 'block_actions' || b.type === 'interactive_message') {
      console.log('Processing block_actions, action_id:', b.actions?.[0]?.action_id);
      // Acknowledge immediately
      res.send('');

      // Process the action asynchronously
      setImmediate(async () => {
        try {
          const action = b.actions[0];
          const actionId = action.action_id;

          // Handle type selection buttons
          if (actionId.startsWith('select_')) {
            const type = action.value;
            const { buildFormModal } = await import('../src/lib/slack.js');

            await app.client.views.open({
              trigger_id: b.trigger_id,
              view: buildFormModal(type)
            });
          }
          // Handle copy buttons
          else if (actionId.startsWith('copy_')) {
            const data = JSON.parse(action.value);
            const userId = b.user.id;

            const dm = await app.client.conversations.open({
              users: userId
            });

            const { buildCopyDM } = await import('../src/lib/slack.js');
            await app.client.chat.postMessage({
              channel: dm.channel.id,
              ...buildCopyDM(data.part, data.content)
            });
          }
          // Handle regenerate button
          else if (actionId === 'regenerate') {
            const { buildFormModal } = await import('../src/lib/slack.js');
            await app.client.views.open({
              trigger_id: b.trigger_id,
              view: buildFormModal(action.value)
            });
          }
          // Handle done button
          else if (actionId === 'done') {
            // Nothing to do
          }
          // Handle edit button
          else if (actionId === 'edit_chinese') {
            const data = JSON.parse(action.value);
            const { buildEditModal } = await import('../src/lib/slack.js');
            await app.client.views.open({
              trigger_id: b.trigger_id,
              view: buildEditModal(data.type, data.currentData)
            });
          }
        } catch (error) {
          console.error('Action handler error:', error);
        }
      });

      return;
    }

    // Handle view submissions
    if (b.type === 'view_submission') {
      console.log('Processing view_submission, callback_id:', b.view?.callback_id);
      // Acknowledge immediately
      res.send('');

      // Process asynchronously
      setImmediate(async () => {
        try {
          const callbackId = b.view.callback_id;
          const view = b.view;
          const userId = b.user.id;
          const channelId = b.user?.channel || b.channel_id;

          // Handle announcement form submission
          if (callbackId === 'announcement_form') {
            const type = view.private_metadata || extractTypeFromView(view);
            const { parseFormData } = await import('../src/lib/slack.js');
            const formData = parseFormData(view, type);

            // Send loading message
            const loadingMsg = await app.client.chat.postMessage({
              channel: channelId,
              text: '⏳ 正在生成公告，请稍候... / Generating announcement, please wait...'
            });

            // Load glossary and generate
            const { loadGlossary } = await import('../src/lib/glossary.js');
            const { generateAnnouncement } = await import('../src/lib/zhipu.js');
            const glossary = loadGlossary();
            const result = await generateAnnouncement(type, formData, glossary);

            // Delete loading message
            await app.client.chat.delete({
              channel: channelId,
              ts: loadingMsg.ts
            });

            // Send result
            const { buildAnnouncementResult } = await import('../src/lib/slack.js');
            await app.client.chat.postMessage({
              channel: channelId,
              ...buildAnnouncementResult(result, type)
            });
          }
          // Handle edit form submission
          else if (callbackId === 'edit_form') {
            const metadata = JSON.parse(view.private_metadata || '{}');
            const type = metadata.type;
            const originalData = metadata.originalData || {};

            const state = view.state?.values || {};
            const cnTitle = state.cn_title?.title_value?.value || originalData.cnTitle || '';
            const cnContent = state.cn_content?.content_value?.value || originalData.cnContent || '';

            // Send loading message
            const loadingMsg = await app.client.chat.postMessage({
              channel: channelId,
              text: '⏳ 正在重新翻译... / Re-translating...'
            });

            // Load glossary and re-translate
            const { loadGlossary } = await import('../src/lib/glossary.js');
            const { reTranslateAfterEdit } = await import('../src/lib/zhipu.js');
            const glossary = loadGlossary();

            const originalEnglish = `Title: ${originalData.enTitle}\nContent: ${originalData.enContent}`;
            const newEnglish = await reTranslateAfterEdit(cnTitle, cnContent, originalEnglish, glossary);

            // Parse result
            const { buildAnnouncementResult } = await import('../src/lib/slack.js');
            const result = parseEnglishResult(newEnglish, cnTitle, cnContent, originalData);

            // Delete loading message
            await app.client.chat.delete({
              channel: channelId,
              ts: loadingMsg.ts
            });

            // Send updated result
            await app.client.chat.postMessage({
              channel: channelId,
              ...buildAnnouncementResult(result, type)
            });
          }
        } catch (error) {
          console.error('View submission error:', error);
          await app.client.chat.postMessage({
            channel: b.user?.channel || b.channel_id,
            text: `❌ Error: ${error.message}`
          });
        }
      });

      return;
    }

    // For any other requests
    res.send('');
  } catch (error) {
    console.error('Handler error:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

// Helper function to extract type from view
function extractTypeFromView(view) {
  const blocks = view.blocks || [];
  for (const block of blocks) {
    if (block.type === 'input' && block.label?.text) {
      const text = block.label.text.toLowerCase();
      if (text.includes('maintenance') && text.includes('preview')) return 'maintenance-preview';
      if (text.includes('known')) return 'known-issue';
      if (text.includes('daily') || text.includes('restart')) return 'daily-restart';
      if (text.includes('temporary') && text.includes('preview')) return 'temp-maintenance-preview';
      if (text.includes('temporary') && !text.includes('preview')) return 'temp-maintenance';
      if (text.includes('resource')) return 'resource-update';
      if (text.includes('compensation')) return 'compensation';
    }
  }
  return 'maintenance-preview';
}

// Helper function to parse English result
function parseEnglishResult(englishText, cnTitle, cnContent, originalData) {
  let enTitle = '';
  let enContent = '';

  const lines = englishText.split('\n');
  let contentLines = [];
  let inContent = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inContent && trimmed.length > 0 && trimmed.length < 100 && !contentLines.length) {
      enTitle = trimmed;
    } else {
      inContent = true;
      contentLines.push(line);
    }
  }

  enContent = contentLines.join('\n').trim();

  if (!enTitle) enTitle = originalData.enTitle || cnTitle;
  if (!enContent) enContent = originalData.enContent || cnContent;

  return {
    cnTitle,
    cnContent,
    enTitle,
    enContent
  };
}
