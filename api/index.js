// Slack Bot - TR Announcement Bot (Simple /translate Command Version)
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

// Announcement type configurations with templates
const announcementTypes = [
  {
    id: 'maintenance-preview',
    name: '维护预告',
    emoji: '🔧',
    template: `标题: 维护预告
内容: 亲爱的冒险者，
Teon: Revelation将于服务器时间【日期】【时间】进行更新维护，届时我们将关闭服务器。预计维护时间【X】小时，开服时间为【开服时间】。详细的更新内容请留意官网及游戏内的更新公告。`
  },
  {
    id: 'known-issue',
    name: '已知问题',
    emoji: '⚠️',
    template: `标题: 已知问题公告
内容: 亲爱的冒险者，
我们核实发现如下问题：
【问题描述】。
对于给您造成的不便，我们深表歉意。目前问题正在抓紧修复中，修复之后将另行通知。`
  },
  {
    id: 'daily-restart',
    name: '日常重启',
    emoji: '🔄',
    template: `标题: 日常重启更新公告
内容: 亲爱的冒险者，
我们已于服务器时间【日期】【时间】日常重启服务器时修复如下问题：
【修复内容】。
对于给您造成的不便，我们深表歉意。如有问题请随时联系我们，祝您游戏愉快！`
  },
  {
    id: 'temp-maintenance-preview',
    name: '临时维护预告',
    emoji: '⏰',
    template: `标题: 临时维护预告
内容: 亲爱的冒险者，
目前我们核实到【问题原因】，为了尽快修复此问题，我们将会在服务器时间【维护时间】进行服务器维护，预计维护时间【X】小时，开服时间为【开服时间】。对于给您造成的不便，我们深表歉意。`
  },
  {
    id: 'temp-maintenance',
    name: '临时维护',
    emoji: '🚨',
    template: `标题: 临时维护公告
内容: 亲爱的冒险者，
由于【问题】，目前玩家无法正常登录游戏。因此我们将对服务器进行临时维护。
维护时间：服务器时间【开始时间】至【结束时间】
根据维护进度，维护时间可能会有所延长。维护进度早于预期完成，会提前结束维护，开放登入。给玩家造成不便，我们深表歉意。`
  },
  {
    id: 'resource-update',
    name: '资源更新',
    emoji: '📦',
    template: `标题: 资源更新公告
内容: 亲爱的冒险者，
我们已于服务器时间【日期】【时间】推出新的资源。新资源号：【资源号】。本次资源更新将修复如下问题：
【修复内容】。
祝您游戏愉快！`
  },
  {
    id: 'compensation',
    name: '补偿邮件',
    emoji: '🎁',
    template: `标题: 补偿邮件
内容: Subject: Compensation Package

Dear Adventurer,

We have recently made some fixes and appreciate your patience during this period.
As a token of our apology, we have sent a small compensation package to your in-game mailbox. Please check your mail and enjoy the rewards!

Package Contents:
【物品】

Friendly Reminder:
- The mail will be automatically deleted in 7 days. Please claim the rewards in time.
- Ensure you have sufficient storage space before claiming to avoid any failures.
- Only one character per account is eligible to claim this compensation package.

Sincerely,
Teon: Revelation Team`
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
    // Parse request body
    let body = req.body;
    const contentType = req.headers['content-type'] || '';

    // Handle URL-encoded form data
    if (contentType.includes('application/x-www-form-urlencoded')) {
      if (body && typeof body === 'object') {
        if (!body.command && !body.payload) {
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
        body = parseUrlEncoded(body);
      }
    }

    // Handle payload (interactive components)
    if (body && body.payload) {
      body = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload;
    }

    console.log('Body type:', body?.type, 'command:', body?.command);

    // Handle URL verification
    if (body?.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // Handle /announce command
    if (body?.command === '/announce') {
      const channelId = body.channel_id;
      const userId = body.user_id;
      await sendTypeSelection(userId, channelId);
      return res.send('');
    }

    // Handle /translate command
    if (body?.command === '/translate') {
      const channelId = body.channel_id;
      const userId = body.user_id;
      const text = body.text || '';

      if (!text.trim()) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '请提供翻译内容 / Please provide content to translate\n\n格式 / Format: /translate 标题: xxx\n内容: xxx'
        });
        return res.send('');
      }

      await handleTranslate(userId, channelId, text);
      return res.send('');
    }

    // Handle button clicks
    if (body?.type === 'block_actions') {
      const action = body.actions[0];
      const channelId = body.channel?.id;
      const userId = body.user.id;

      // Handle type selection
      if (action.action_id.startsWith('select_')) {
        const type = action.value;
        const announcement = announcementTypes.find(t => t.id === type);
        if (announcement) {
          await sendTemplate(userId, channelId, announcement);
        }
        return res.send('');
      }

      // Handle copy buttons
      if (action.action_id.startsWith('copy_')) {
        const data = JSON.parse(action.value);
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
    ],
    text: '选择公告类型'
  });
}

/**
 * Send template to user (ephemeral in current channel)
 */
async function sendTemplate(userId, channelId, announcement) {
  // For mobile copy - template content must be in text field
  const templateText = `${announcement.template}`;

  // Send template as ephemeral message
  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📋 ${announcement.name} 模板` }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*请复制下方模板，修改【】内容，然后使用 /translate 翻译*' }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '```\n' + announcement.template + '\n```' }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*⚠️ 格式注意事项 / Format Notes:*' }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '• 必须保留 `标题:` 和 `内容:` 开头\n• 标题和内容之间用换行分隔\n• 内容可以多行' }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*翻译命令示例:*' }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '`/translate 标题: 维护预告\n内容: 亲爱的冒险者...`' }
      }
    ],
    // text field is used for mobile copy - must include full template
    text: `📋 ${announcement.name} 模板\n\n${templateText}\n\n请修改【】内容后使用 /translate 翻译`
  });
}

/**
 * Handle /translate command
 */
async function handleTranslate(userId, channelId, text) {
  try {
    // Parse input
    const cnTitleMatch = text.match(/标题[：:]\s*(.+?)(?=\n|内容|$)/i);
    const cnContentMatch = text.match(/内容[：:]\s*(.+)/is);

    let cnTitle = cnTitleMatch ? cnTitleMatch[1].trim() : null;
    let cnContent = cnContentMatch ? cnContentMatch[1].trim() : null;

    // Alternative: split by first newline
    if (!cnTitle && !cnContent && text.includes('\n')) {
      const parts = text.split('\n', 2);
      cnTitle = parts[0].trim();
      cnContent = parts[1]?.trim() || '';
    } else if (!cnTitle && !cnContent) {
      cnTitle = text;
      cnContent = '';
    }

    // Send loading message
    const loadingMsg = await client.chat.postMessage({
      channel: channelId,
      ...buildLoadingMessage('正在翻译... / Translating...')
    });

    // Load glossary and translate
    const glossary = loadGlossary();
    console.log(`Translation: Loaded ${glossary.length} glossary entries`);
    const fullText = `${cnTitle}\n\n${cnContent}`;
    const englishResult = await translateToEnglish(fullText, glossary);

    // Delete loading message
    await client.chat.delete({ channel: channelId, ts: loadingMsg.ts });

    // Parse English result
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

    // Send final result (ephemeral - only visible to user)
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '✅ 翻译完成 / Translation Complete' }
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*📢 中文标题 / Chinese Title*\n${cnTitle}` }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*📝 中文内容 / Chinese Content*\n\`\`\`${cnContent}\`\`\`` }
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*📢 英文标题 / English Title*\n${enTitle}` }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*📝 英文内容 / English Content*\n\`\`\`${enContent}\`\`\`` }
        },
        { type: 'divider' },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              action_id: `copy_cn`,
              text: { type: 'plain_text', text: '📋 复制中文' },
              value: JSON.stringify({ content: `${cnTitle}\n\n${cnContent}` })
            },
            {
              type: 'button',
              action_id: `copy_en`,
              text: { type: 'plain_text', text: '📋 Copy English' },
              value: JSON.stringify({ content: `${enTitle}\n\n${enContent}` })
            }
          ]
        }
      ],
      text: '翻译完成'
    });

  } catch (error) {
    console.error('Translation error:', error);
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      ...buildErrorMessage(error)
    });
  }
}
