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
  console.log('Request:', req.method, req.url);

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

    // For now, skip signature verification for debugging
    const app = await getApp();

    // Handle payload format (interactive components)
    let b = req.body;
    if (req.body.payload) {
      if (typeof req.body.payload === 'string') {
        b = JSON.parse(req.body.payload);
      } else {
        b = req.body.payload;
      }
      console.log('Parsed payload, type:', b.type);
    } else {
      console.log('Body type:', b?.type);
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

    // Handle actions (button clicks)
    if (b.type === 'block_actions' || b.type === 'interactive_message') {
      console.log('Processing block_actions, action_id:', b.actions?.[0]?.action_id);

      const action = b.actions[0];
      const actionId = action.action_id;

      // Handle type selection buttons
      if (actionId.startsWith('select_')) {
        const type = action.value;
        console.log('Selected type:', type);

        // Instead of opening a modal, send a message with input
        const typeLabels = {
          'maintenance-preview': '维护预告 / Maintenance Preview',
          'known-issue': '已知问题 / Known Issue',
          'daily-restart': '日常重启 / Daily Restart',
          'temp-maintenance-preview': '临时维护预告 / Temp Maintenance Preview',
          'temp-maintenance': '临时维护 / Temp Maintenance',
          'resource-update': '资源更新 / Resource Update',
          'compensation': '补偿邮件 / Compensation'
        };

        await app.client.chat.postMessage({
          channel: b.channel?.id || b.channel_id,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `你选择了: *${typeLabels[type] || type}*\n\n由于技术限制，暂时无法打开表单。请直接在频道中输入以下格式：`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*请提供以下信息:*\n日期时间 / 关键问题 / 更新内容\n\n请直接发送，例如：\n> 2025-03-05 14:00 服务器维护 2小时\n或\n> 登录问题 无法进入游戏`
              }
            }
          ]
        });

        return res.send('');
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

        return res.send('');
      }
      // Handle regenerate button
      else if (actionId === 'regenerate') {
        return res.send('');
      }
      // Handle done button
      else if (actionId === 'done') {
        return res.send('');
      }
      // Handle edit button
      else if (actionId === 'edit_chinese') {
        return res.send('');
      }

      return res.send('');
    }

    // Handle view submissions
    if (b.type === 'view_submission') {
      console.log('Processing view_submission, callback_id:', b.view?.callback_id);
      return res.json({ response_action: 'clear' });
    }

    res.send('');
  } catch (error) {
    console.error('Handler error:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
