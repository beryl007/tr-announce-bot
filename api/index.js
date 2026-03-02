// Slack Bot - TR Announcement Bot
import { App } from '@slack/bolt';
import { buildTypeSelectionModal, buildFormModal, buildAnnouncementResult, buildLoadingMessage, buildErrorMessage, parseFormData } from '../src/lib/slack.js';
import { generateAnnouncement } from '../src/lib/zhipu.js';
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
    // Parse request body
    let body = req.body;

    // Handle payload (interactions)
    if (req.body.payload) {
      if (typeof req.body.payload === 'string') {
        body = JSON.parse(req.body.payload);
      } else {
        body = req.body.payload;
      }
    }

    // Generate unique request ID for deduplication
    const requestId = `${req.headers['x-slack-request-timestamp']}_${body.type}_${JSON.stringify(body).slice(0, 50)}`;

    // Check if we already processed this request
    if (processedRequests.has(requestId)) {
      console.log('Duplicate request, ignoring:', requestId);
      return res.send('');
    }
    processedRequests.set(requestId, Date.now());

    // Handle URL verification
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // Handle slash commands
    if (body.type === 'command' && body.command === '/announce') {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: buildTypeSelectionModal()
      });
      return res.send('');
    }

    // Handle block_actions (button clicks)
    if (body.type === 'block_actions') {
      const action = body.actions[0];
      const actionId = action.action_id;

      console.log('Action:', actionId);

      // Handle type selection button
      if (actionId.startsWith('select_')) {
        const type = action.value;
        const channelId = body.channel?.id || body.container?.channel_id;

        try {
          const view = buildFormModal(type);
          view.private_metadata = JSON.stringify({ type, channelId });

          await client.views.open({
            trigger_id: body.trigger_id,
            view: view
          });
        } catch (error) {
          console.error('Error opening form modal:', error);
          await client.chat.postMessage({
            channel: channelId,
            ...buildErrorMessage(error)
          });
        }
      }
      // Handle other actions (copy, regenerate, edit, done)
      else if (actionId.startsWith('copy_')) {
        const data = JSON.parse(action.value);
        const userId = body.user.id;

        const dm = await client.conversations.open({ users: userId });
        await client.chat.postMessage({
          channel: dm.channel.id,
          text: `*${data.part}*\n${data.content}`
        });

        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: '✅ 已发送到私信 / Sent to DM ✓'
        });
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
      else if (actionId === 'edit_chinese') {
        // TODO: Implement edit flow
        await client.chat.postEphemeral({
          channel: body.channel?.id,
          user: body.user.id,
          text: '⚠️ 编辑功能暂未实现 / Edit feature coming soon'
        });
      }

      return res.send('');
    }

    // Handle view_submission (form submit)
    if (body.type === 'view_submission') {
      const view = body.view;
      const userId = body.user.id;

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
