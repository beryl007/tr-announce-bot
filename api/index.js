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

    // Check timestamp
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      console.log('Request too old');
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
      console.log('Parsed payload, type:', b.type);
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

    // Handle actions from modal (no channel context)
    if (b.type === 'block_actions') {
      console.log('Processing block_actions, action_id:', b.actions?.[0]?.action_id);
      console.log('Full body keys:', Object.keys(b));

      const action = b.actions[0];
      const actionId = action.action_id;
      const userId = b.user?.id;

      // Handle type selection buttons
      if (actionId.startsWith('select_')) {
        const type = action.value;
        console.log('Selected type:', type, 'user ID:', userId);

        const typeLabels = {
          'maintenance-preview': '维护预告 / Maintenance Preview',
          'known-issue': '已知问题 / Known Issue',
          'daily-restart': '日常重启 / Daily Restart',
          'temp-maintenance-preview': '临时维护预告 / Temp Maintenance Preview',
          'temp-maintenance': '临时维护 / Temp Maintenance',
          'resource-update': '资源更新 / Resource Update',
          'compensation': '补偿邮件 / Compensation'
        };

        // Open DM and send a message requesting info
        const dm = await app.client.conversations.open({
          users: userId
        });

        await app.client.chat.postMessage({
          channel: dm.channel.id,
          text: `你选择了: *${typeLabels[type] || type}*\n\n⚠️ 由于 Slack API 限制，无法在模态框中收集信息。\n\n请直接回复以下格式的信息：`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*你选择了: ${typeLabels[type] || type}*\n\n⚠️ 由于 Slack API 限制，无法在模态框中收集信息。\n\n请直接回复以下格式的信息：`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*维护预告格式:*\n\`日期 时间(24h) 预计时长(小时) 备注\`\n\`例如: 2025-03-05 14:00 2 紧急修复登录问题\`\n\n*已知问题格式:*\n\`问题描述 解决方案\`\n\`例如: 无法登录游戏 请尝试重启应用\`\n\n*其他类型格式:*\n\`关键信息1, 关键信息2, ...\`\n\n请直接回复以上格式，我们将生成双语公告。`
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '我已了解，开始使用'
                  },
                  value: 'acknowledged',
                  action_id: 'ack_start'
                }
              ]
            }
          ]
        });

        return res.send('');
      }

      return res.send('');
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
