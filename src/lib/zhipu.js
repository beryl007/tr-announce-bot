import { getConfig } from './config.js';

const config = getConfig();

/**
 * Call Zhipu GLM API
 */
export async function callZhipuAPI(messages, options = {}) {
  const apiKey = config.zhipuApiKey;

  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY is not configured');
  }

  // Parse API key (format: id.secret)
  const [id, secret] = apiKey.split('.');
  if (!id || !secret) {
    throw new Error('Invalid ZHIPU_API_KEY format. Expected: id.secret');
  }

  // Generate JWT token
  const token = generateJWT(id, secret);

  const response = await fetch(
    `https://open.bigmodel.cn/api/paas/v4/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: options.model || config.zhipuModel,
        messages: messages,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.9,
        max_tokens: options.max_tokens || 2000
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zhipu API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Generate JWT for Zhipu API authentication
 */
function generateJWT(apiKeyId, apiKeySecret) {
  const header = {
    alg: 'HS256',
    sign_type: 'SIGN'
  };

  const now = Date.now();
  const payload = {
    api_key: apiKeyId,
    exp: now + 3600000, // 1 hour expiration
    timestamp: now
  };

  // Simple JWT implementation (for production, use a proper JWT library)
  const headerBase64 = base64UrlEncode(JSON.stringify(header));
  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));

  const signature = hmacSha256(
    `${headerBase64}.${payloadBase64}`,
    apiKeySecret
  );

  return `${headerBase64}.${payloadBase64}.${signature}`;
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * HMAC SHA256
 */
function hmacSha256(data, secret) {
  const crypto = require('crypto');
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate announcement using Zhipu GLM
 */
export async function generateAnnouncement(type, formData, glossary = []) {
  const prompt = buildPrompt(type, formData, glossary);

  const messages = [
    {
      role: 'system',
      content: getSystemPrompt()
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  const result = await callZhipuAPI(messages);
  return parseAnnouncementResult(result);
}

/**
 * Translate Chinese to English using glossary
 */
export async function translateToEnglish(chineseText, glossary = []) {
  const glossaryContext = buildGlossaryContext(glossary);

  const messages = [
    {
      role: 'system',
      content: `You are a professional translator for a mobile game called "Teon: Revelation".

${glossaryContext}

Rules:
1. Translate the Chinese text to English
2. Use the glossary terms when matching Chinese terms appear
3. Maintain the tone and style of official game announcements
4. Keep placeholders like [时间], [内容] unchanged
5. Keep the format and structure of the original text`
    },
    {
      role: 'user',
      content: `Translate this to English:\n\n${chineseText}`
    }
  ];

  return await callZhipuAPI(messages);
}

/**
 * Re-translate after Chinese edit
 */
export async function reTranslateAfterEdit(chineseTitle, chineseContent, originalEnglish, glossary = []) {
  const glossaryContext = buildGlossaryContext(glossary);

  const messages = [
    {
      role: 'system',
      content: `You are a professional translator for a mobile game called "Teon: Revelation".

${glossaryContext}

Rules:
1. The user has edited the Chinese version, translate it to English
2. Use the glossary terms when matching Chinese terms appear
3. Keep the tone consistent with the original English version
4. Maintain the structure and format`
    },
    {
      role: 'user',
      content: `Original English for reference:
${originalEnglish}

Please translate this updated Chinese:
Title: ${chineseTitle}
Content: ${chineseContent}`
    }
  ];

  return await callZhipuAPI(messages);
}

/**
 * Build system prompt
 */
function getSystemPrompt() {
  return `You are a professional game announcement writer for "Teon: Revelation", a mobile MMORPG.

Your task is to generate bilingual (Chinese and English) announcements based on the user's input.

Important rules:
1. Always include both Chinese and English versions
2. Format the output clearly with "中文标题:", "中文内容:", "英文标题:", "英文内容:" labels
3. Time format: Always add "【服务器时间】" before any time mentions
4. For times before 12:00, specify "上午" (AM); after 12:00, specify "下午" (PM)
5. Game name: Use "Teon: Revelation" in English
6. Timezone: Use (UTC+8) for English announcements
7. Never mention compensation in announcements (compensation emails are sent separately)
8. Maintain professional and friendly tone
9. Keep sentences clear and concise`;
}

/**
 * Build prompt based on announcement type
 */
function buildPrompt(type, formData, glossary) {
  const glossaryContext = buildGlossaryContext(glossary);

  const templates = {
    'maintenance-preview': {
      name: '维护预告 / Maintenance Preview',
      prompt: `Generate a maintenance preview announcement with:
- Maintenance date: ${formData.date || '[日期]'}
- Start time: ${formData.startTime || '[开始时间]'}
- Duration: ${formData.duration || '[时长]'} hours
- Estimated reopen: ${formData.reopenTime || '[开服时间]'}

Template reference:
中文: 亲爱的冒险者，【游戏】于【时间】更新维护，届时我们将关闭服务器。预计维护时间x小时，开服时间为xx。详细的更新内容请留意官网及游戏内的更新公告
英文: Dear Adventurers, [Game] will be undergoing maintenance on [Time], during which the server will be closed. The maintenance is expected to last for x hours and the server is expected to reopen at xx.`
    },
    'known-issue': {
      name: '已知问题公告 / Known Issue Announcement',
      prompt: `Generate a known issue announcement with:
- Issue description: ${formData.issueDescription || '[问题描述]'}
- Solution: ${formData.solution || '[处理方案]'}

Template reference:
中文: 亲爱的冒险者，我们核实发现如下问题：[问题描述]。对于给您造成的不便，我们深表歉意。目前问题正在抓紧修复中，修复之后将另行通知。
英文: Dear Adventurers, We have verified and found the following issues: [问题描述]. We apologize for any inconvenience caused. The problem is currently being fixed and we will notify you when it is fixed.`
    },
    'daily-restart': {
      name: '日常重启更新公告 / Daily Restart Update Announcement',
      prompt: `Generate a daily restart update announcement with:
- Restart time: ${formData.restartTime || '[重启时间]'}
- Fixed issues: ${formData.fixes || '[修复内容]'}

Template reference:
中文: 亲爱的冒险者，我们已于【时间】日常重启服务器时修复如下问题：[修复内容]。对于给您造成的不便，我们深表歉意。如有问题请随时联系我们，祝您游戏愉快！
英文: Dear Adventurers, we have fixed the following issues during the daily restart of the server at [time]: [修复内容]. We apologize for any inconvenience caused. Please feel free to contact us if you have any questions, and enjoy the game!`
    },
    'temp-maintenance-preview': {
      name: '临时维护预告 / Temporary Maintenance Preview',
      prompt: `Generate a temporary maintenance preview announcement with:
- Issue reason: ${formData.reason || '[问题原因]'}
- Maintenance time: ${formData.maintenanceTime || '[维护时间]'}
- Duration: ${formData.duration || '[时长]'} hours
- Estimated reopen: ${formData.reopenTime || '[开服时间]'}

Template reference:
中文: 亲爱的冒险者，目前我们核实到【问题】，为了尽快修复此问题，我们将会在【时间】进行服务器维护，预计维护时间x小时，开服时间为xx时间。对于给您造成的不便，我们深表歉意。
英文: Dear Adventurers, at present we have verified [problem], in order to fix this problem as soon as possible, we will carry out server maintenance at [time], the expected maintenance time x hours, the opening time is xx time. We apologize for the inconvenience caused to you.`
    },
    'temp-maintenance': {
      name: '临时维护公告 / Temporary Maintenance Announcement',
      prompt: `Generate a temporary maintenance announcement with:
- Start time: ${formData.startTime || '[开始时间]'}
- Estimated end: ${formData.endTime || '[结束时间]'}
- Impact: ${formData.impact || '[维护影响]'}

Template reference:
中文: 亲爱的冒险者，由于[原因]，目前玩家无法正常登录游戏。因此我们将对服务器进行临时维护。
维护时间：[时间]
维护影响：[影响说明]
根据维护进度，维护时间可能会有所延长。
维护进度早于预期完成，会提前结束维护，开放登入。
给玩家造成不便，我们深表歉意。

英文: Dear Adventurers, Due to an unexpected [problem], players are currently unable to log into the game, therefore the server is undergoing a temporary maintenance.
Maintenance Period: [time] (UTC+8)
Impact: [impact]
Please note:
1. The maintenance period may be extended depending on the progress of the work.
2. If the maintenance is completed ahead of schedule, the servers will be reopened earlier.
We sincerely apologize for any inconvenience this may cause.`
    },
    'resource-update': {
      name: '资源更新公告 / Resource Update Announcement',
      prompt: `Generate a resource update announcement with:
- Update time: ${formData.updateTime || '[更新时间]'}
- Resource version: ${formData.resourceVersion || '[资源号]'}
- Fixed issues: ${formData.fixes || '[修复内容]'}

Template reference:
中文: 亲爱的冒险者，我们已于【时间】推出新的资源。新资源号：[资源号]。本次资源更新将修复如下问题：[修复内容]。祝您游戏愉快
英文: Dear Adventurers, We have launched a new resource at [time]. New Resource: [资源号]. This resource update will fix the following issues: [修复内容]. Enjoy your game!`
    },
    'compensation': {
      name: '补偿邮件 / Compensation Package',
      prompt: `Generate a compensation email with:
- Package contents: ${formData.contents || '[物品列表]'}

Template reference:
Subject: Compensation Package

Dear Adventurer,

We have recently made some fixes and appreciate your patience during this period.
As a token of our apology, we have sent a small compensation package to your in-game mailbox. Please check your mail and enjoy the rewards!

Package Contents:
[物品]

Friendly Reminder:
- The mail will be automatically deleted in 7 days. Please claim the rewards in time.
- Ensure you have sufficient storage space before claiming to avoid any failures.
- Only one character per account is eligible to claim this compensation package.

Sincerely,
Teon: Revelation Team`
    }
  };

  const template = templates[type];
  if (!template) {
    throw new Error(`Unknown announcement type: ${type}`);
  }

  return `${glossaryContext}

Please generate a ${template.name} announcement.

${template.prompt}

Remember:
- All times must include "【服务器时间】" in Chinese and "(UTC+8)" in English
- For times before 12:00, use "上午" (AM) in Chinese
- For times 12:00 or later, use "下午" (PM) in Chinese
- Never mention compensation in announcements (compensation emails are separate)

Output format:
中文标题: [title]
中文内容: [content]
英文标题: [title]
英文内容: [content]`;
}

/**
 * Build glossary context for prompt
 */
function buildGlossaryContext(glossary) {
  if (!glossary || glossary.length === 0) {
    return '';
  }

  // Build a simplified glossary context
  const glossaryItems = glossary
    .slice(0, 100) // Limit to avoid token limit
    .map(item => `- ${item.cn} → ${item.en}`)
    .join('\n');

  return `Game Terminology Glossary (use these translations):
${glossaryItems}`;
}

/**
 * Parse AI response into structured result
 */
function parseAnnouncementResult(result) {
  const lines = result.split('\n');
  const parsed = {
    cnTitle: '',
    cnContent: '',
    enTitle: '',
    enContent: ''
  };

  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('中文标题:') || trimmed.startsWith('中文标题：')) {
      if (currentSection) {
        parsed[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = 'cnTitle';
      currentContent = [trimmed.replace(/中文标题[：:]\s*/, '')];
    } else if (trimmed.startsWith('中文内容:') || trimmed.startsWith('中文内容：')) {
      if (currentSection) {
        parsed[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = 'cnContent';
      currentContent = [];
    } else if (trimmed.startsWith('英文标题:') || trimmed.startsWith('英文标题：')) {
      if (currentSection) {
        parsed[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = 'enTitle';
      currentContent = [trimmed.replace(/英文标题[：:]\s*/, '')];
    } else if (trimmed.startsWith('英文内容:') || trimmed.startsWith('英文内容：')) {
      if (currentSection) {
        parsed[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = 'enContent';
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection) {
    parsed[currentSection] = currentContent.join('\n').trim();
  }

  return parsed;
}
