// Slack Bot - TR Announcement Bot
import crypto from 'crypto';

let appInstance = null;

// Track user selections
const sentDMs = new Map();

async function getApp() {
  if (!appInstance) {
    const { App } = (await import('@slack/bolt')).default;
    appInstance = new App({
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      token: process.env.SLACK_BOT_TOKEN,
    });
    console.log('Slack app initialized');
  }
  return appInstance;
}

export default async function handler(req, res) {
  console.log('Request:', req.method, req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.json({ status: 'ok', message: 'TR Announcement Bot is running' });
  }

  try {
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];

    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return res.status(401).json({ error: 'Request too old' });
    }

    const app = await getApp();

    // Handle payload format
    let b = req.body;
    if (req.body.payload) {
      if (typeof req.body.payload === 'string') {
        b = JSON.parse(req.body.payload);
      } else {
        b = req.body.payload;
      }
    }

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

    // Handle actions - MUST respond within 3 seconds!
    if (b.type === 'block_actions') {
      const action = b.actions[0];
      const actionId = action.action_id;
      const userId = b.user?.id;

      console.log('Action:', actionId, 'User:', userId);

      // IMPORTANT: Respond immediately to prevent timeout
      res.send('');

      // Then handle the action asynchronously
      setImmediate(async () => {
        try {
          // Handle type selection
          if (actionId.startsWith('select_')) {
            const type = action.value;

            // Check if we already sent a DM recently
            const lastDM = sentDMs.get(userId);
            const now = Date.now();

            // Only send DM if type changed or > 30 seconds ago
            if (!lastDM || (now - lastDM.timestamp > 30000) || (lastDM.type !== type)) {
              console.log('Sending DM for type:', type);

              try {
                const dm = await app.client.conversations.open({ users: userId });

                await app.client.chat.postMessage({
                  channel: dm.channel.id,
                  text: 'You selected: ' + type + '. Please reply with your input.'
                });

                sentDMs.set(userId, { type, timestamp: now });
              } catch (error) {
                console.log('Failed to send DM:', error.message);
              }
            } else {
              console.log('DM already sent recently, skipping. Type:', type);
            }
          }
        } catch (error) {
          console.error('Async action handler error:', error);
        }
      });

      return;
    }

    // Handle event callbacks (direct messages)
    if (b.type === 'event_callback') {
      const event = b.event;

      // Handle message events
      if (event?.type === 'message' && event?.subtype !== 'bot_message' && event?.text) {
        const userId = event.user;
        const channelId = event.channel;
        const userText = event.text.trim();

        console.log('Message from user:', userId, 'Text:', userText);

        // Get user's selected type
        const selection = sentDMs.get(userId);

        if (selection && selection.type) {
          const timeDiff = Date.now() - selection.timestamp;

          // Selection is valid for 10 minutes
          if (timeDiff < 600000) {
            console.log('Generating announcement for:', selection.type);

            try {
              const { generateAnnouncement } = await import('../src/lib/zhipu.js');
              const { loadGlossary } = await import('../src/lib/glossary.js');
              const { buildAnnouncementResult } = await import('../src/lib/slack.js');

              const formData = parseUserInput(userText, selection.type);
              const glossary = loadGlossary();
              const result = await generateAnnouncement(selection.type, formData, glossary);

              await app.client.chat.postMessage({
                channel: channelId,
                ...buildAnnouncementResult(result, selection.type)
              });

              sentDMs.delete(userId);
            } catch (error) {
              console.error('Generation error:', error);
              await app.client.chat.postMessage({
                channel: channelId,
                text: 'Error: ' + error.message
              });
            }
          } else {
            await app.client.chat.postMessage({
              channel: channelId,
              text: 'Selection expired. Use /announce to start again.'
            });
          }
        } else {
          await app.client.chat.postMessage({
            channel: channelId,
            text: 'Please use /announce command to select type first.'
          });
        }

        return res.json({ ok: true });
      }

      return res.json({ ok: true });
    }

    res.send('');
  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

// Parse user input based on type
function parseUserInput(text, type) {
  const formData = {};

  if (type === 'maintenance-preview') {
    const parts = text.split(/\s+/);
    formData.date = parts[0] || '';
    formData.startTime = parts[1] || '';
    formData.duration = parts[2] || '1';
    formData.notes = parts.slice(3).join(' ') || '';
  } else if (type === 'known-issue') {
    const parts = text.split(/[，,]/);
    formData.issueDescription = parts[0] || text;
    formData.solution = parts[1] || '请联系客服';
  } else {
    formData.description = text;
  }

  return formData;
}
