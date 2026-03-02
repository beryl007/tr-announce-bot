// Slack Bot - TR Announcement Bot
import crypto from 'crypto';

let appInstance = null;

// Track user selections - in production, use a database
const sentDMs = new Map();

// Track processed requests to prevent duplicates (Slack retry mechanism)
const processedRequests = new Map();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  // Clean up processed requests older than 1 minute
  for (const [reqId, timestamp] of processedRequests.entries()) {
    if (now - timestamp > 60000) {
      processedRequests.delete(reqId);
    }
  }
  // Clean up expired selections
  for (const [userId, data] of sentDMs.entries()) {
    if (now - data.timestamp > 600000) {
      sentDMs.delete(userId);
    }
  }
}, 30000);

// Store the type in a special format in the DM message
// Format: [TYPE:xxx] followed by the actual message
function encodeTypeInMessage(type) {
  return `[TYPE:${type}] You selected: ${type}. Please reply with your input.`;
}

function extractTypeFromBotMessage(text) {
  const match = text.match(/\[TYPE:(\w+(?:-\w+)*)\]/);
  return match ? match[1] : null;
}

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

      // Generate unique request ID for deduplication
      const requestId = `action_${userId}_${actionId}_${action.action_ts || Date.now()}`;

      // Check if we already processed this request
      if (processedRequests.has(requestId)) {
        console.log('Duplicate action request, ignoring:', requestId);
        return res.send('');
      }
      processedRequests.set(requestId, Date.now());

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
                  text: encodeTypeInMessage(type)
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

      // Handle message events - ONLY in DM channels (im), NOT in channels
      if (event?.type === 'message' && event?.subtype !== 'bot_message' && event?.subtype !== 'message_changed' && event?.text) {
        const userId = event.user;
        const channelId = event.channel;
        const userText = event.text.trim();

        // Ignore messages that look like our own type markers
        if (userText.startsWith('[TYPE:')) {
          console.log('Ignoring type marker message:', userText);
          return res.json({ ok: true });
        }

        // Generate unique request ID for deduplication
        const requestId = `event_${userId}_${event.ts}`;
        if (processedRequests.has(requestId)) {
          console.log('Duplicate event request, ignoring:', requestId);
          return res.json({ ok: true });
        }
        processedRequests.set(requestId, Date.now());

        // Only process DM messages (channel starts with 'D')
        if (!channelId || !channelId.startsWith('D')) {
          console.log('Ignoring non-DM message, channel:', channelId);
          return res.json({ ok: true });
        }

        console.log('DM from user:', userId, 'Text:', userText);

        // Respond immediately to prevent timeout
        res.json({ ok: true });

        // Process message asynchronously
        setImmediate(async () => {
          try {
            // First check in-memory cache
            let type = null;
            const selection = sentDMs.get(userId);
            if (selection && (Date.now() - selection.timestamp < 600000)) {
              type = selection.type;
            }

            // If not in cache, try to get from conversation history
            if (!type) {
              try {
                const history = await app.client.conversations.history({
                  channel: channelId,
                  limit: 10
                });

                // Find the last bot message with TYPE marker
                for (const msg of history.messages) {
                  if (msg.subtype === 'bot_message' && msg.text && msg.text.includes('[TYPE:')) {
                    type = extractTypeFromBotMessage(msg.text);
                    if (type) {
                      console.log('Found type from history:', type);
                      // Cache it for future use
                      sentDMs.set(userId, { type, timestamp: Date.now() });
                      break;
                    }
                  }
                }
              } catch (historyError) {
                console.error('Failed to fetch history:', historyError.message);
              }
            }

            if (type) {
              console.log('Generating announcement for:', type);

              const { generateAnnouncement } = await import('../src/lib/zhipu.js');
              const { loadGlossary } = await import('../src/lib/glossary.js');
              const { buildAnnouncementResult } = await import('../src/lib/slack.js');

              const formData = parseUserInput(userText, type);
              const glossary = loadGlossary();
              const result = await generateAnnouncement(type, formData, glossary);

              await app.client.chat.postMessage({
                channel: channelId,
                ...buildAnnouncementResult(result, type)
              });

              sentDMs.delete(userId);
            } else {
              await app.client.chat.postMessage({
                channel: channelId,
                text: 'Please use /announce command to select type first.'
              });
            }
          } catch (error) {
            console.error('Async message handler error:', error);
          }
        });

        return;
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
