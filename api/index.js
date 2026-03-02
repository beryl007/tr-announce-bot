// Slack Bot - TR Announcement Bot
import pkg from '@slack/bolt';
const { App } = pkg;
import { buildTypeSelectionModal, buildFormModal, buildAnnouncementResult, buildLoadingMessage, buildErrorMessage, buildCopyDM, buildEditModal, parseFormData } from '../src/lib/slack.js';
import { generateAnnouncement, reTranslateAfterEdit } from '../src/lib/zhipu.js';
import { loadGlossary } from '../src/lib/glossary.js';

// Initialize Slack client (not full Bolt app)
const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

// Get the API client directly
const client = app.client;

// Request ID tracking for deduplication
const processedRequests = new Map();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [reqId, timestamp] of processedRequests.entries()) {
    if (now - timestamp > 60000) {
      processedRequests.delete(reqId);
    }
  }
}, 30000);

// Vercel serverless function handler
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
    // Parse request body - handle different formats
    let body = req.body;

    // Debug logging
    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.body type:', typeof req.body);
    console.log('req.body keys:', req.body ? Object.keys(req.body) : 'null');

    // If body is a string, try to parse it
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error('Failed to parse body as JSON:', e);
      }
    }

    // Handle payload (interactions)
    if (body && body.payload) {
      if (typeof body.payload === 'string') {
        body = JSON.parse(body.payload);
      } else {
        body = body.payload;
      }
    }

    console.log('Parsed body type:', body?.type);

    // Generate unique request ID for deduplication
    const requestId = `${req.headers['x-slack-request-timestamp']}_${body?.type}_${JSON.stringify(body).slice(0, 50)}`;

    // Check if we already processed this request
    if (processedRequests.has(requestId)) {
      console.log('Duplicate request, ignoring:', requestId);
      return res.send('');
    }
    processedRequests.set(requestId, Date.now());

    // Handle URL verification
    if (body?.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // Handle slash commands
    if (body?.command === '/announce') {
      console.log('Handling /announce command');
      console.log('trigger_id:', body.trigger_id);

      try {
        const view = buildTypeSelectionModal();
        console.log('Built view:', JSON.stringify(view).slice(0, 200));

        const result = await client.views.open({
          trigger_id: body.trigger_id,
          view: view
        });

        console.log('View opened result:', result);
      } catch (viewError) {
        console.error('Error opening view:', viewError);
        console.error('Error details:', JSON.stringify(viewError, Object.getOwnPropertyNames(viewError)));
        return res.status(500).json({ error: viewError.message, details: viewError.data });
      }

      return res.send('');
    }

    // Handle block_actions (button clicks)
    if (body?.type === 'block_actions') {
      const action = body.actions[0];
      const actionId = action.action_id;

      console.log('Action:', actionId);
      console.log('Action value:', action.value);
      console.log('Trigger ID:', body.trigger_id);
      console.log('Channel:', body.channel?.id, 'Container:', body.container?.channel_id);

      // Handle type selection button
      if (actionId.startsWith('select_')) {
        const type = action.value;
        const channelId = body.channel?.id || body.container?.channel_id;

        console.log('Opening form modal for type:', type, 'channel:', channelId);

        try {
          const view = buildFormModal(type);
          // Don't store channelId since it doesn't exist when coming from modal
          // Result will be sent to DM instead
          view.private_metadata = JSON.stringify({ type, channelId: null });

          console.log('Form view built, opening...');
          // Use views.push instead of views.open for modal-to-modal navigation
          const result = await client.views.push({
            trigger_id: body.trigger_id,
            view: view
          });

          console.log('Form modal opened:', result);
        } catch (error) {
          console.error('Error opening form modal:', error);
          console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

          // Try to send error message to channel
          if (channelId) {
            try {
              await client.chat.postMessage({
                channel: channelId,
                ...buildErrorMessage(error)
              });
            } catch (msgError) {
              console.error('Failed to send error message:', msgError);
            }
          }
        }
      }
      // Handle other actions (copy, regenerate, edit, done)
      else if (actionId.startsWith('copy_')) {
        const data = JSON.parse(action.value);
        const userId = body.user.id;

        const dm = await client.conversations.open({ users: userId });
        await client.chat.postMessage({
          channel: dm.channel.id,
          ...buildCopyDM(data.part, data.content)
        });

        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: '✅ 已发送到私信 / Sent to DM ✓'
        });
      }
      else if (actionId === 'edit_chinese') {
        console.log('Edit Chinese action');
        const data = JSON.parse(action.value);
        console.log('Edit data:', JSON.stringify(data).slice(0, 200));
        const userId = body.user.id;

        try {
          console.log('Building edit modal...');
          const view = buildEditModal(data.type, data.currentData);
          console.log('Edit modal built, pushing...');
          // Use views.push to stack on top of current modal
          const result = await client.views.push({
            trigger_id: body.trigger_id,
            view: view
          });
          console.log('Edit modal pushed:', result);
        } catch (error) {
          console.error('Error opening edit modal:', error);
          console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
          // Send to DM if modal fails
          try {
            const dm = await client.conversations.open({ users: userId });
            await client.chat.postMessage({
              channel: dm.channel.id,
              text: `⚠️ 编辑功能暂时不可用\n请重新生成公告 / Edit feature unavailable\nPlease regenerate announcement`
            });
          } catch (dmError) {
            console.error('Failed to send DM error message:', dmError);
          }
        }
      }
      else if (actionId === 'regenerate') {
        const type = action.value;
        const channelId = body.channel?.id;

        try {
          const view = buildFormModal(type);
          view.private_metadata = JSON.stringify({ type, channelId });

          await client.views.open({
            trigger_id: body.trigger_id,
            view: view
          });
        } catch (error) {
          console.error('Error opening form for regeneration:', error);
        }
      }
      else if (actionId === 'done') {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: '✅ 完成！如需重新生成，请使用 /announce'
        });
      }

      return res.send('');
    }

    // Handle view_submission (form submit)
    if (body?.type === 'view_submission') {
      const view = body.view;
      const userId = body.user.id;

      // Check if this is the edit form or announcement form
      const callbackId = view.callback_id;

      if (callbackId === 'edit_form') {
        // Handle edit form submission
        const channelId = body.channel?.id || body.user?.channel;

        try {
          // Parse metadata
          const metadata = JSON.parse(view.private_metadata || '{}');
          const type = metadata.type;
          const originalData = metadata.originalData || {};

          // Get edited values
          const state = view.state?.values || {};
          const cnTitle = state.cn_title?.title_value?.value || originalData.cnTitle || '';
          const cnContent = state.cn_content?.content_value?.value || originalData.cnContent || '';

          // Send loading message
          const loadingMsg = await client.chat.postMessage({
            channel: channelId,
            ...buildLoadingMessage('正在重新翻译... / Re-translating...')
          });

          // Load glossary
          const glossary = loadGlossary();

          // Re-translate
          const originalEnglish = `Title: ${originalData.enTitle}\nContent: ${originalData.enContent}`;
          const newEnglish = await reTranslateAfterEdit(cnTitle, cnContent, originalEnglish, glossary);

          // Parse the result
          const result = parseEnglishResult(newEnglish, cnTitle, cnContent, originalData);

          // Delete loading message
          await client.chat.delete({
            channel: channelId,
            ts: loadingMsg.ts
          });

          // Send updated result
          await client.chat.postMessage({
            channel: channelId,
            ...buildAnnouncementResult(result, type)
          });

        } catch (error) {
          console.error('Error re-translating:', error);
          await client.chat.postMessage({
            channel: channelId,
            ...buildErrorMessage(error)
          });
        }

        return res.json({ response_action: 'clear' });
      }

      // Handle announcement form submission
      // Parse metadata
      let type = 'maintenance-preview';
      let channelId = null;

      try {
        const metadata = JSON.parse(view.private_metadata || '{}');
        type = metadata.type || type;
        channelId = metadata.channelId;
      } catch (e) {
        // Keep default type
      }

      // If no channel_id, open DM
      let targetChannel = channelId;
      if (!targetChannel) {
        try {
          const dm = await client.conversations.open({ users: userId });
          targetChannel = dm.channel.id;
        } catch (dmError) {
          console.error('Failed to open DM:', dmError);
        }
      }

      try {
        // Parse form data
        const formData = parseFormData(view, type);
        console.log('Parsed formData for type', type, ':', JSON.stringify(formData));

        // Send loading message
        const loadingMsg = await client.chat.postMessage({
          channel: targetChannel,
          ...buildLoadingMessage('正在生成公告，请稍候... / Generating announcement, please wait...')
        });

        // Load glossary
        const glossary = loadGlossary();

        // Generate announcement
        const result = await generateAnnouncement(type, formData, glossary);

        // Delete loading message
        await client.chat.delete({
          channel: targetChannel,
          ts: loadingMsg.ts
        });

        // Send result
        await client.chat.postMessage({
          channel: targetChannel,
          ...buildAnnouncementResult(result, type)
        });

      } catch (error) {
        console.error('Error generating announcement:', error);
        await client.chat.postMessage({
          channel: targetChannel,
          ...buildErrorMessage(error)
        });
      }

      return res.json({ response_action: 'clear' });
    }

    console.log('Unhandled event type:', body.type);
    res.send('');

  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * Parse English translation result
 */
function parseEnglishResult(englishText, cnTitle, cnContent, originalData) {
  // Simple parsing - look for patterns
  let enTitle = '';
  let enContent = '';

  const lines = englishText.split('\n');
  let contentLines = [];
  let inContent = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this looks like a title (first line or short line)
    if (!inContent && trimmed.length > 0 && trimmed.length < 100 && !contentLines.length) {
      enTitle = trimmed;
    } else {
      inContent = true;
      contentLines.push(line);
    }
  }

  enContent = contentLines.join('\n').trim();

  // Fallback to original if parsing failed
  if (!enTitle) enTitle = originalData.enTitle || cnTitle;
  if (!enContent) enContent = originalData.enContent || cnContent;

  return {
    cnTitle,
    cnContent,
    enTitle,
    enContent
  };
}

