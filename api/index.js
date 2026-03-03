// Slack Bot - TR Announcement Bot (Template-Based Simplified Version)
import pkg from '@slack/bolt';
const { App } = pkg;
import { buildLoadingMessage, buildErrorMessage } from '../src/lib/slack.js';
import { translateToEnglish } from '../src/lib/zhipu.js';
import { loadGlossary } from '../src/lib/glossary.js';

/**
 * Parse URL-encoded form data
 */
function parseUrlEncoded(str) {
  const params = new URLSearchParams(str);
  const result = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

// Initialize Slack client
const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});
const client = app.client;

// Store for user input state (key: user_channel)
const userStates = new Map();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of userStates.entries()) {
    if (now - data.timestamp > 1800000) { // 30 minutes
      userStates.delete(key);
    }
  }
}, 300000);

// Announcement type configurations with templates
const announcementTypes = [
  {
    id: 'maintenance-preview',
    name: '维护预告 / Maintenance',
    emoji: '🔧',
    template: {
      cnTitle: '维护预告',
      cnContent: '亲爱的冒险者，Teon: Revelation将于【日期】【时间】进行更新维护，届时我们将关闭服务器。预计维护时间【X】小时，开服时间为【开服时间】。详细的更新内容请留意官网及游戏内的更新公告。'
    }
  },
  {
    id: 'known-issue',
    name: '已知问题 / Known Issue',
    emoji: '⚠️',
    template: {
      cnTitle: '已知问题公告',
      cnContent: '亲爱的冒险者，我们核实发现如下问题：【问题描述】。对于给您造成的不便，我们深表歉意。目前问题正在抓紧修复中，修复之后将另行通知。'
    }
  },
  {
    id: 'daily-restart',
    name: '日常重启 / Daily Restart',
    emoji: '🔄',
    template: {
      cnTitle: '日常重启更新公告',
      cnContent: '亲爱的冒险者，我们已于【时间】日常重启服务器时修复如下问题：【修复内容】。对于给您造成的不便，我们深表歉意。如有问题请随时联系我们，祝您游戏愉快！'
    }
  },
  {
    id: 'temp-maintenance-preview',
    name: '临时维护预告 / Temp Mtn',
    emoji: '⏰',
    template: {
      cnTitle: '临时维护预告',
      cnContent: '亲爱的冒险者，目前我们核实到【问题原因】，为了尽快修复此问题，我们将会在【维护时间】进行服务器维护，预计维护时间【X】小时，开服时间为【开服时间】。对于给您造成的不便，我们深表歉意。'
    }
  },
  {
    id: 'temp-maintenance',
    name: '临时维护 / Temp Maintenance',
    emoji: '🚨',
    template: {
      cnTitle: '临时维护公告',
      cnContent: '亲爱的冒险者，由于【问题】，目前玩家无法正常登录游戏。因此我们将对服务器进行临时维护。\n维护时间：【开始时间】至【结束时间】\n根据维护进度，维护时间可能会有所延长。维护进度早于预期完成，会提前结束维护，开放登入。给玩家造成不便，我们深表歉意。'
    }
  },
  {
    id: 'resource-update',
    name: '资源更新 / Resource Update',
    emoji: '📦',
    template: {
      cnTitle: '资源更新公告',
      cnContent: '亲爱的冒险者，我们已于【时间】推出新的资源。新资源号：【资源号】。本次资源更新将修复如下问题：【修复内容】。祝您游戏愉快！'
    }
  },
  {
    id: 'compensation',
    name: '补偿邮件 / Compensation',
    emoji: '🎁',
    template: {
      cnTitle: '补偿邮件',
      cnContent: 'Subject: Compensation Package\n\nDear Adventurer,\n\nWe have recently made some fixes and appreciate your patience during this period.\nAs a token of our apology, we have sent a small compensation package to your in-game mailbox. Please check your mail and enjoy the rewards!\n\nPackage Contents:\n【物品列表】\n\nFriendly Reminder:\n- The mail will be automatically deleted in 7 days. Please claim the rewards in time.\n- Ensure you have sufficient storage space before claiming to avoid any failures.\n- Only one character per account is eligible to claim this compensation package.\n\nSincerely,\nTeon: Revelation Team'
    }
  }
];

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
    const contentType = req.headers['content-type'] || '';

    // Debug: log what we received
    console.log('Content-Type:', contentType);
    console.log('Body type:', typeof body);
    console.log('Body keys:', body ? Object.keys(body).slice(0, 10) : 'null');

    // Handle URL-encoded form data (slash commands)
    if (contentType.includes('application/x-www-form-urlencoded')) {
      if (body && typeof body === 'object') {
        if (body.command && typeof body.command === 'string') {
          console.log('Using pre-parsed form data');
        } else {
          const rawBody = req.rawBody || req.body;
          if (typeof rawBody === 'string') {
            body = parseUrlEncoded(rawBody);
          }
        }
      } else if (typeof body === 'string') {
        body = parseUrlEncoded(body);
      }
    } else if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        console.log('JSON parse failed, trying URL encoding');
        body = parseUrlEncoded(body);
      }
    }

    // Handle payload (interactive components)
    if (body && body.payload) {
      body = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload;
    }

    console.log('Final body type:', body?.type, 'command:', body?.command, 'user:', body?.user_id || body?.user?.id);

    // Handle URL verification
    if (body?.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // Handle slash commands
    if (body?.command === '/announce') {
      const channelId = body.channel_id;
      const userId = body.user_id || body.user?.id;
      const stateKey = `${userId}_${channelId}`;

      // Clear any previous state
      userStates.delete(stateKey);

      // Send ephemeral message with type selection buttons
      await sendTypeSelection(userId, channelId);
      return res.send('');
    }

    // Handle button clicks
    if (body?.type === 'block_actions') {
      const action = body.actions[0];
      const actionId = action.action_id;
      const channelId = body.channel?.id;
      const userId = body.user.id;
      const stateKey = `${userId}_${channelId}`;

      console.log('Action:', actionId, 'User:', userId, 'Channel:', channelId);

      // Handle type selection - show template
      if (actionId.startsWith('select_')) {
        const type = action.value;
        const announcement = announcementTypes.find(t => t.id === type);

        if (announcement) {
          // Send template to DM and enter edit mode
          await sendTemplateToUser(userId, channelId, type, announcement.template);
        }
        return res.send('');
      }

      // Handle cancel button
      if (actionId === 'cancel') {
        userStates.delete(stateKey);
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '✅ 已取消 / Cancelled'
        });
        return res.send('');
      }

      // Handle copy buttons
      if (actionId.startsWith('copy_')) {
        const data = JSON.parse(action.value);
        if (!data.content || data.content.trim() === '') {
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: '⚠️ 该部分内容为空 / This section is empty'
          });
          return res.send('');
        }

        const dm = await client.conversations.open({ users: userId });
        await client.chat.postMessage({
          channel: dm.channel.id,
          text: data.content,
          blocks: [{ type: 'section', text: { type: 'mrkdwn', text: data.content } }]
        });

        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '✅ 已发送到私信 / Sent to DM ✓'
        });
        return res.send('');
      }

      res.send('');
    }

    // Handle message events (for user posting edited content)
    if (body?.type === 'event_callback') {
      const event = body.event;

      if (event?.type === 'message' && !event.bot_id && event.text) {
        const userId = event.user;
        const channelId = event.channel;
        const text = event.text.trim();
        const stateKey = `${userId}_${channelId}`;
        const state = userStates.get(stateKey);

        // Handle cancel command
        if (text === '/cancel') {
          userStates.delete(stateKey);
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: '✅ 已取消 / Cancelled'
          });
          return res.send('');
        }

        // Handle edit mode - user posts their edited content
        if (state && state.type === 'template_edit') {
          // Parse user input for title and content
          const cnTitleMatch = text.match(/标题[：:]\s*(.+?)(?=\n|内容|$)/i);
          const cnContentMatch = text.match(/内容[：:]\s*(.+)/is);

          let cnTitle = cnTitleMatch ? cnTitleMatch[1].trim() : null;
          let cnContent = cnContentMatch ? cnContentMatch[1].trim() : null;

          // Alternative: if no explicit labels, try to split by first newline
          if (!cnTitle && !cnContent && text.includes('\n')) {
            const parts = text.split('\n', 2);
            cnTitle = parts[0].trim();
            cnContent = parts[1]?.trim() || '';
          } else if (!cnTitle && !cnContent) {
            // Single line - treat as title only
            cnTitle = text;
            cnContent = state.template.cnContent || '';
          }

          // Use template values if not provided
          cnTitle = cnTitle || state.template.cnTitle || '';
          cnContent = cnContent || state.template.cnContent || '';

          try {
            // Send loading message
            const loadingMsg = await client.chat.postMessage({
              channel: channelId,
              ...buildLoadingMessage('正在翻译英文... / Translating to English...')
            });

            // Load glossary and translate
            const glossary = loadGlossary();
            const fullText = `${cnTitle}\n\n${cnContent}`;
            const englishResult = await translateToEnglish(fullText, glossary);

            // Delete loading message
            await client.chat.delete({ channel: channelId, ts: loadingMsg.ts });

            // Parse English result (simple split)
            let enTitle = cnTitle;
            let enContent = englishResult;

            if (englishResult.includes('\n')) {
              const lines = englishResult.split('\n');
              const firstLine = lines[0].trim();
              if (firstLine.length < 100 && firstLine.length > 0) {
                enTitle = firstLine;
                enContent = lines.slice(1).join('\n').trim();
              }
            }

            // Send final result
            await sendFinalResult(userId, channelId, {
              cnTitle,
              cnContent,
              enTitle,
              enContent,
              announcementType: state.announcementType
            });

            userStates.delete(stateKey);
          } catch (error) {
            console.error('Error translating:', error);
            await client.chat.postEphemeral({
              channel: channelId,
              user: userId,
              ...buildErrorMessage(error)
            });
          }

          return res.send('');
        }

        res.send('');
      }
    }

    res.send('');

  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * Send type selection buttons (ephemeral)
 */
async function sendTypeSelection(userId, channelId) {
  const typeButtons = announcementTypes.map(t => ({
    type: 'button',
    action_id: `select_${t.id}`,
    text: { type: 'plain_text', text: `${t.emoji} ${t.name}` },
    value: t.id
  }));

  // Split into rows of 3 buttons
  const rows = [];
  for (let i = 0; i < typeButtons.length; i += 3) {
    rows.push({
      type: 'actions',
      elements: typeButtons.slice(i, i + 3)
    });
  }

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*请选择公告类型 / Please select announcement type:*' }
      },
      ...rows
    ]
  });
}

/**
 * Send template to user and enter edit mode
 */
async function sendTemplateToUser(userId, channelId, announcementType, template) {
  const stateKey = `${userId}_${channelId}`;

  // Set state for edit mode
  userStates.set(stateKey, {
    type: 'template_edit',
    template,
    announcementType,
    timestamp: Date.now()
  });

  // Send template to DM
  try {
    const dm = await client.conversations.open({ users: userId });
    await client.chat.postMessage({
      channel: dm.channel.id,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*📋 公告模板 / Announcement Template*\n\n请复制以下内容，修改后在频道中发送 / Copy and edit, then post in channel:' }
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*标题:*\n${template.cnTitle}` }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*内容:*\n${template.cnContent}` }
        }
      ],
      text: '📋 公告模板 / Template'
    });
  } catch (dmError) {
    console.error('Failed to send DM:', dmError);
  }

  // Send ephemeral with instructions
  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*✏️ 模板已发送到你的私信 / Template sent to your DM*\n\n请按以下步骤操作 / Please follow these steps:' }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '1. 从私信中复制模板 / Copy template from DM\n2. 修改【】中的内容 / Edit content in【】\n3. 在此频道发送修改后的内容 / Post edited content here' }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*发送格式 / Format:*' }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '```\n标题: 修改后的标题\n内容: 修改后的内容\n```' }
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: '💡 或直接发送修改后的完整文本，会自动识别 / Or send the full edited text directly' }]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'cancel',
            text: { type: 'plain_text', text: '❌ 取消 / Cancel' }
          }
        ]
      }
    ],
    text: '✏️ 模板已发送 / Template sent'
  });
}

/**
 * Send final result with copy buttons
 */
async function sendFinalResult(userId, channelId, result) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '✅ 公告已生成 / Announcement Generated' }
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*📢 中文标题 / Chinese Title*\n${result.cnTitle || ''}` }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*📝 中文内容 / Chinese Content*\n\`\`\`${result.cnContent || ''}\`\`\`` }
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*📢 英文标题 / English Title*\n${result.enTitle || ''}` }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*📝 英文内容 / English Content*\n\`\`\`${result.enContent || ''}\`\`\`` }
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: `copy_cn`,
          text: { type: 'plain_text', text: '📋 复制中文' },
          value: JSON.stringify({ content: `${result.cnTitle}\n\n${result.cnContent}` })
        },
        {
          type: 'button',
          action_id: `copy_en`,
          text: { type: 'plain_text', text: '📋 Copy English' },
          value: JSON.stringify({ content: `${result.enTitle}\n\n${result.enContent}` })
        }
      ]
    }
  ];

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    blocks,
    text: '✅ 公告已生成 / Announcement Generated'
  });
}
