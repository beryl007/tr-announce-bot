// Slack Bot - TR Announcement Bot (No Modal Version)
import pkg from '@slack/bolt';
const { App } = pkg;
import { buildLoadingMessage, buildErrorMessage } from '../src/lib/slack.js';
import { generateAnnouncement, reTranslateAfterEdit } from '../src/lib/zhipu.js';
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

// Store for pending form data (key: userId_channelId_timestamp)
const pendingForms = new Map();
// Store for user input state (key: user_channel)
const userStates = new Map();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of pendingForms.entries()) {
    if (now - data.timestamp > 1800000) { // 30 minutes
      pendingForms.delete(key);
    }
  }
  for (const [key, data] of userStates.entries()) {
    if (now - data.timestamp > 1800000) {
      userStates.delete(key);
    }
  }
}, 300000);

// Announcement type configurations
const announcementTypes = [
  { id: 'maintenance-preview', name: '维护预告 / Maintenance', emoji: '🔧' },
  { id: 'known-issue', name: '已知问题 / Known Issue', emoji: '⚠️' },
  { id: 'daily-restart', name: '日常重启 / Daily Restart', emoji: '🔄' },
  { id: 'temp-maintenance-preview', name: '临时维护预告 / Temp Mtn Preview', emoji: '⏰' },
  { id: 'temp-maintenance', name: '临时维护 / Temp Maintenance', emoji: '🚨' },
  { id: 'resource-update', name: '资源更新 / Resource Update', emoji: '📦' },
  { id: 'compensation', name: '补偿邮件 / Compensation', emoji: '🎁' }
];

// Field configurations for each type
const typeFields = {
  'maintenance-preview': [
    { key: 'date', label: '维护日期 / Maintenance Date', placeholder: '2024-03-05' },
    { key: 'startTime', label: '开始时间 / Start Time', placeholder: '10:00' },
    { key: 'duration', label: '时长(小时) / Duration (hours)', placeholder: '4' }
  ],
  'known-issue': [
    { key: 'issueDescription', label: '问题描述 / Issue Description', placeholder: 'Describe the issue...' },
    { key: 'solution', label: '处理方案 / Solution (optional)', placeholder: 'How to fix...' }
  ],
  'daily-restart': [
    { key: 'restartDate', label: '重启日期 / Restart Date', placeholder: '2024-03-05' },
    { key: 'restartTime', label: '重启时间 / Restart Time', placeholder: '10:00' },
    { key: 'fixes', label: '修复内容 / Fixed Issues', placeholder: 'List the issues fixed...' }
  ],
  'temp-maintenance-preview': [
    { key: 'reason', label: '问题原因 / Issue Reason', placeholder: 'Describe the issue...' },
    { key: 'maintenanceDate', label: '维护日期 / Maintenance Date', placeholder: '2024-03-05' },
    { key: 'startTime', label: '开始时间 / Start Time', placeholder: '12:00' },
    { key: 'duration', label: '时长(小时) / Duration (hours)', placeholder: '2' }
  ],
  'temp-maintenance': [
    { key: 'impact', label: '影响 / Impact', placeholder: 'Unable to log into the game' },
    { key: 'startTime', label: '开始时间 / Start Time', placeholder: 'March 5, 2024, 12:00' },
    { key: 'endTime', label: '结束时间 / End Time', placeholder: '14:00' }
  ],
  'resource-update': [
    { key: 'updateDate', label: '更新日期 / Update Date', placeholder: '2024-03-05' },
    { key: 'updateTime', label: '更新时间 / Update Time', placeholder: '10:00' },
    { key: 'resourceVersion', label: '资源号 / Resource Version', placeholder: '1.2.3' },
    { key: 'fixes', label: '修复内容 / Fixed Issues', placeholder: 'List the issues...' }
  ],
  'compensation': [
    { key: 'contents', label: '物品列表 / Package Contents', placeholder: 'List the compensation items...' }
  ]
};

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
      // Vercel may parse this automatically as an object with string values
      // If it's already an object but has URL-encoded string values, decode them
      if (body && typeof body === 'object') {
        // Try to find command field to determine if parsing worked
        if (body.command && typeof body.command === 'string') {
          // Already parsed correctly
          console.log('Using pre-parsed form data');
        } else {
          // Need manual parsing
          const rawBody = req.rawBody || req.body;
          if (typeof rawBody === 'string') {
            body = parseUrlEncoded(rawBody);
          }
        }
      } else if (typeof body === 'string') {
        body = parseUrlEncoded(body);
      }
    } else if (typeof body === 'string') {
      // Handle JSON string
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
      // Slash commands use user_id, interactive components use user.id
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

      // Handle type selection
      if (actionId.startsWith('select_')) {
        const type = action.value;
        const fields = typeFields[type];

        // Initialize state
        userStates.set(stateKey, {
          type,
          fieldIndex: 0,
          fields: {},
          timestamp: Date.now()
        });

        // Ask for first field
        await askForField(userId, channelId, fields[0]);
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

      // Handle regenerate
      if (actionId === 'regenerate') {
        const type = action.value;
        const fields = typeFields[type];

        userStates.set(stateKey, {
          type,
          fieldIndex: 0,
          fields: {},
          timestamp: Date.now()
        });

        await askForField(userId, channelId, fields[0]);
        return res.send('');
      }

      // Handle done
      if (actionId === 'done') {
        userStates.delete(stateKey);
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '✅ 完成！如需重新生成，请使用 /announce'
        });
        return res.send('');
      }

      // Handle edit button
      if (actionId === 'edit_chinese') {
        const data = JSON.parse(action.value);

        // Send ephemeral with current content and edit instructions
        await sendEditInstructions(userId, channelId, data.type, data.currentData);
        return res.send('');
      }

      // Handle submit edit button
      if (actionId === 'submit_edit') {
        const data = JSON.parse(action.value);

        // Enter edit mode - wait for user to reply in channel
        userStates.set(`${userId}_${channelId}`, {
          type: 'edit',
          originalData: data.currentData,
          announcementType: data.type,
          timestamp: Date.now()
        });

        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: '*✏️ 编辑模式已激活 / Edit Mode Activated*\n\n请直接在频道中输入修改后的中文内容：' }
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: '*格式 1 - 分开输入 (推荐) / Format 1 - Separate (Recommended):*' }
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: '```\n中文标题: 新标题\n中文内容: 新内容\n```' }
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: '*格式 2 - 一行输入 / Format 2 - One Line:*' }
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: '```\n标题: 内容\n```' }
            },
            {
              type: 'context',
              elements: [{ type: 'mrkdwn', text: '💡 发送 /done 完成编辑，发送 /cancel 取消 / Send /done to finish, /cancel to cancel' }]
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
          text: '✏️ 编辑模式 / Edit Mode'
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

    // Handle message events (for form input and edit)
    if (body?.type === 'event_callback') {
      const event = body.event;

      // Handle direct messages or app mentions
      if (event?.type === 'message' && !event.bot_id && event.text) {
        const userId = event.user;
        const channelId = event.channel;
        const text = event.text.trim();
        const stateKey = `${userId}_${channelId}`;
        const state = userStates.get(stateKey);

        // Handle cancel command
        if (text === '/cancel' || text === '/skip') {
          userStates.delete(stateKey);
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: '✅ 已取消 / Cancelled'
          });
          return res.send('');
        }

        // Handle edit mode
        if (state && state.type === 'edit') {
          // Try to parse as edit content (supports multiple formats)
          const cnTitleMatch = text.match(/中文标题[：:]\s*(.+?)(?=\n|中文内容|$)/i);
          const cnContentMatch = text.match(/中文内容[：:]\s*(.+)/is);

          // Check if this looks like valid edit content
          if (cnTitleMatch || cnContentMatch || (text.includes(':') && text.split('\n').length <= 10)) {
            try {
              // Parse edited content
              let cnTitle = cnTitleMatch ? cnTitleMatch[1].trim() : null;
              let cnContent = cnContentMatch ? cnContentMatch[1].trim() : null;

              // Alternative format: "标题: 内容" (single line or multiline)
              if (!cnTitle && !cnContent && text.includes(':')) {
                const colonIndex = text.indexOf(':');
                cnTitle = text.substring(0, colonIndex).trim();
                cnContent = text.substring(colonIndex + 1).trim();
              }

              // Use original values if not provided
              cnTitle = cnTitle || state.originalData.cnTitle || '';
              cnContent = cnContent || state.originalData.cnContent || '';

              // Send loading message
              const loadingMsg = await client.chat.postMessage({
                channel: channelId,
                ...buildLoadingMessage('正在重新翻译... / Re-translating...')
              });

              // Load glossary and re-translate
              const glossary = loadGlossary();
              const originalEnglish = `Title: ${state.originalData.enTitle}\nContent: ${state.originalData.enContent}`;
              const newEnglish = await reTranslateAfterEdit(cnTitle, cnContent, originalEnglish, glossary);

              // Parse result
              const result = parseEnglishResult(newEnglish, cnTitle, cnContent, state.originalData);

              // Delete loading message
              await client.chat.delete({ channel: channelId, ts: loadingMsg.ts });

              // Send updated result
              await sendAnnouncementResult(userId, channelId, result, state.announcementType || 'maintenance-preview');
            } catch (error) {
              console.error('Error re-translating:', error);
              await client.chat.postEphemeral({
                channel: channelId,
                user: userId,
                ...buildErrorMessage(error)
              });
            }

            userStates.delete(stateKey);
            return res.send('');
          }

          // Not recognized as edit content - show hint
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: '无法识别格式。请使用指定格式提交修改，或使用 /cancel 取消\nFormat not recognized. Please use the specified format, or /cancel to cancel'
          });
          return res.send('');
        }

        // Handle form input state
        if (state && state.type !== 'edit') {
          const fields = typeFields[state.type];
          const currentField = fields[state.fieldIndex];

          // Save the input
          state.fields[currentField.key] = text;
          state.fieldIndex++;
          state.timestamp = Date.now();
          userStates.set(stateKey, state);

          // Check if there are more fields
          if (state.fieldIndex < fields.length) {
            await askForField(userId, channelId, fields[state.fieldIndex]);
          } else {
            // All fields collected, generate announcement
            await generateAndSendAnnouncement(userId, channelId, state.type, state.fields);
            userStates.delete(stateKey);
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
 * Ask for a field value
 */
async function askForField(userId, channelId, field) {
  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: `请输入 / Please enter: *${field.label}*\n\n(输入 /cancel 取消 / Type /cancel to cancel)`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${field.label}*` }
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `示例 / Example: ${field.placeholder}` }]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'cancel',
            text: { type: 'plain_text', text: '❌ 取消 / Cancel' },
            style: 'danger'
          }
        ]
      }
    ]
  });
}

/**
 * Generate and send announcement
 */
async function generateAndSendAnnouncement(userId, channelId, type, formData) {
  // Send loading message
  const loadingMsg = await client.chat.postMessage({
    channel: channelId,
    ...buildLoadingMessage('正在生成公告，请稍候... / Generating announcement...')
  });

  try {
    // Parse form data
    const parsedFormData = parseFormData(type, formData);

    // Load glossary
    const glossary = loadGlossary();

    // Generate announcement
    const result = await generateAnnouncement(type, parsedFormData, glossary);

    // Delete loading message
    await client.chat.delete({ channel: channelId, ts: loadingMsg.ts });

    // Send result
    await sendAnnouncementResult(userId, channelId, result, type);
  } catch (error) {
    console.error('Error generating announcement:', error);
    await client.chat.delete({ channel: channelId, ts: loadingMsg.ts });
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      ...buildErrorMessage(error)
    });
  }
}

/**
 * Send announcement result (ephemeral)
 */
async function sendAnnouncementResult(userId, channelId, result, type) {
  const typeLabels = {
    'maintenance-preview': '维护预告 / Maintenance',
    'known-issue': '已知问题 / Known Issue',
    'daily-restart': '日常重启 / Daily Restart',
    'temp-maintenance-preview': '临时维护预告 / Temp Mtn Preview',
    'temp-maintenance': '临时维护 / Temp Maintenance',
    'resource-update': '资源更新 / Resource',
    'compensation': '补偿邮件 / Compensation'
  };

  // Build result blocks
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `✅ 公告已生成 / Announcement Generated` }
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `*类型 / Type:* ${typeLabels[type] || type}` }]
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
          action_id: `copy_cn_title`,
          text: { type: 'plain_text', text: '📋 复制中文标题' },
          value: JSON.stringify({ part: 'cnTitle', content: result.cnTitle || '' })
        },
        {
          type: 'button',
          action_id: `copy_cn_content`,
          text: { type: 'plain_text', text: '📋 复制中文内容' },
          value: JSON.stringify({ part: 'cnContent', content: result.cnContent || '' })
        }
      ]
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: `copy_en_title`,
          text: { type: 'plain_text', text: '📋 Copy English Title' },
          value: JSON.stringify({ part: 'enTitle', content: result.enTitle || '' })
        },
        {
          type: 'button',
          action_id: `copy_en_content`,
          text: { type: 'plain_text', text: '📋 Copy English Content' },
          value: JSON.stringify({ part: 'enContent', content: result.enContent || '' })
        }
      ]
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: 'edit_chinese',
          text: { type: 'plain_text', text: '✏️ 编辑中文 / Edit Chinese' },
          value: JSON.stringify({ type, currentData: result }),
          style: 'primary'
        },
        {
          type: 'button',
          action_id: 'regenerate',
          text: { type: 'plain_text', text: '🔄 重新生成 / Regenerate' },
          value: type
        },
        {
          type: 'button',
          action_id: 'done',
          text: { type: 'plain_text', text: '✓ 完成 / Done' }
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

/**
 * Send edit instructions (ephemeral)
 */
async function sendEditInstructions(userId, channelId, type, currentData) {
  // Send current content to DM for reference
  try {
    const dm = await client.conversations.open({ users: userId });

    await client.chat.postMessage({
      channel: dm.channel.id,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*📋 当前公告内容 / Current Announcement*\n\n(仅供参考，复制修改后回到频道提交 / For reference only, copy edited version and submit in channel)' }
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*📢 中文标题 / Chinese Title*\n${currentData.cnTitle || ''}` }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*📝 中文内容 / Chinese Content*\n${currentData.cnContent || ''}` }
        }
      ],
      text: '📋 当前公告内容 / Current Announcement'
    });
  } catch (dmError) {
    console.error('Failed to send DM:', dmError);
  }

  // Send ephemeral with edit button
  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*✏️ 编辑中文 / Edit Chinese*\n\n当前内容已发送到你的私信 / Content sent to your DM\n\n点击下方按钮开始编辑 / Click button to start editing:' }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'submit_edit',
            text: { type: 'plain_text', text: '✏️ 开始编辑 / Start Editing' },
            value: JSON.stringify({ type, currentData }),
            style: 'primary'
          }
        ]
      }
    ],
    text: '✏️ 编辑中文 / Edit Chinese'
  });
}

/**
 * Parse form data
 */
function parseFormData(type, formData) {
  const parsed = {};

  for (const [key, value] of Object.entries(formData)) {
    parsed[key] = value;
  }

  // Calculate reopen time for maintenance-preview
  if (type === 'maintenance-preview' && formData.date && formData.startTime && formData.duration) {
    parsed.reopenTime = calculateReopenTime(formData.date, formData.startTime, formData.duration);
  }

  // Calculate reopen time for temp-maintenance-preview
  if (type === 'temp-maintenance-preview' && formData.maintenanceDate && formData.startTime && formData.duration) {
    parsed.maintenanceTime = `${formData.maintenanceDate} ${formData.startTime}`;
    parsed.reopenTime = calculateReopenTime(formData.maintenanceDate, formData.startTime, formData.duration);
  }

  // Combine date and time for daily-restart and resource-update
  if (type === 'daily-restart' && formData.restartDate && formData.restartTime) {
    parsed.restartTime = `${formData.restartDate} ${formData.restartTime}`;
  }
  if (type === 'resource-update' && formData.updateDate && formData.updateTime) {
    parsed.updateTime = `${formData.updateDate} ${formData.updateTime}`;
  }

  return parsed;
}

/**
 * Calculate reopen time
 */
function calculateReopenTime(date, time, duration) {
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const durationHours = parseInt(duration) || 0;
    const endHour = hours + durationHours;
    const endHourFormatted = endHour % 24;
    const ampm = endHour < 12 ? '上午' : '下午';
    return `${ampm} ${String(endHourFormatted).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/**
 * Parse English translation result
 */
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
