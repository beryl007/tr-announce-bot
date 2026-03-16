import { getConfig } from './config.js';
import crypto from 'crypto';

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
      content: `You are an expert MMORPG announcement translator specializing in "Teon: Revelation", a Western fantasy MMORPG.

${glossaryContext}

## Your Role & Expertise

**MMORPG Translation Specialist**: You are a master translator for MMORPG game announcements, deeply familiar with gaming terminology, player culture, and industry standards.

**Fantasy Culture Adapter**: You expertly adapt Chinese announcements into expressions that resonate with Western fantasy gaming audiences, matching the世界观 of "Teon: Revelation."

**Quality Guardian**: You ensure translation quality through accuracy, fluency, and consistency - any error could negatively impact player experience.

## Translation Principles

**1. Formal & Concise**: Use the formal, concise style typical of official MMORPG announcements. Avoid wordiness or overly complex expressions.

**2. Clear & Understandable**: Ensure clarity, especially for game mechanics, event rules, and reward descriptions. Avoid ambiguity that could confuse players.

**3. Cultural Adaptation**: Adapt for English-speaking players' language habits and cultural background. Avoid literal translation of Chinese idioms; convert them into expressions Western gamers understand.

**4. Gaming Terminology**: Use standard MMORPG terminology (server, maintenance, patch, compensation, mailbox, etc.) that English players recognize.

**5. Glossary Consistency**: ALWAYS use the exact glossary terms provided below when matching Chinese terms appear. Consistency is critical for player understanding.

## Output Format

Translate the input maintaining its original structure. If the input has "标题:" (Title) and "内容:" (Content) labels, preserve this format in your translation.

## Special Notes

- Keep placeholders like 【】、【时间】、【内容】 unchanged
- For time expressions, use formats like "10:00 AM (Server Time)" or "March 5, 2024, 14:00 (UTC+8)"
- The game name is "Teon: Revelation"`
    },
    {
      role: 'user',
      content: `Translate the following announcement to English:\n\n${chineseText}`
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
      content: `You are an expert MMORPG announcement translator specializing in "Teon: Revelation", a Western fantasy MMORPG.

${glossaryContext}

## Your Role & Expertise

**MMORPG Translation Specialist**: Expert translator for MMORPG announcements, deeply familiar with gaming terminology and player culture.

**Fantasy Culture Adapter**: Adapt Chinese announcements for Western fantasy gaming audiences.

**Quality Guardian**: Ensure accuracy, fluency, and consistency.

## Translation Principles

1. **Formal & Concise**: Use official MMORPG announcement style
2. **Clear & Understandable**: Avoid ambiguity, especially for game mechanics
3. **Cultural Adaptation**: Adapt for English-speaking players
4. **Glossary Consistency**: ALWAYS use provided glossary terms
5. **Tone Consistency**: Match the tone and style of the original English version below

## Special Notes

- The game name is "Teon: Revelation"
- For time expressions, use formats like "10:00 AM (Server Time)"
- Use glossary terms when matching Chinese appear`
    },
    {
      role: 'user',
      content: `Original English for reference (maintain similar tone and style):
${originalEnglish}

Please translate this updated Chinese to English:
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

CRITICAL RULES:
1. Always use the EXACT values provided by the user - DO NOT copy template placeholders like [时间]、[原因]、[修复内容]
2. NEVER use brackets like 【】 or [] in the final output - they are only for reference in prompts
3. Format the output with labels: "中文标题:", "中文内容:", "英文标题:", "英文内容:"
4. For Chinese time: write naturally (e.g., "上午10:00" or "下午14:00") - DO NOT add "【服务器时间】"
5. For English time: use format like "10:00 AM (UTC+8)" or "2:00 PM (UTC+8)"
6. Game name: Use "Teon: Revelation" in English
7. Never mention compensation in announcements (compensation emails are sent separately)
8. Maintain professional and friendly tone`;
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
- Maintenance date: ${formData.date || 'TBD'}
- Start time: ${formData.startTime || 'TBD'}
- Duration: ${formData.duration || 'TBD'} hours
- Estimated reopen: ${formData.reopenTime || 'TBD'}

Write in this style:
Chinese: 亲爱的冒险者，Teon: Revelation将于${formData.date || '日期'} ${formData.startTime || '时间'}进行更新维护，届时我们将关闭服务器。预计维护时间${formData.duration || 'X'}小时，开服时间为${formData.reopenTime || '时间'}。详细的更新内容请留意官网及游戏内的更新公告。

English: Dear Adventurers, Teon: Revelation will be undergoing maintenance on ${formData.date || 'date'} at ${formData.startTime || 'time'}, during which the server will be closed. The maintenance is expected to last for ${formData.duration || 'X'} hours and the server is expected to reopen at ${formData.reopenTime || 'time'} (UTC+8).`
    },
    'known-issue': {
      name: '已知问题公告 / Known Issue Announcement',
      prompt: `Generate a known issue announcement with:
- Issue description: ${formData.issueDescription || 'See below'}
- Solution: ${formData.solution || 'We are working on a fix'}

Write in this style:
Chinese: 亲爱的冒险者，我们核实发现如下问题：${formData.issueDescription || '[问题描述]'}。对于给您造成的不便，我们深表歉意。目前问题正在抓紧修复中，修复之后将另行通知。

English: Dear Adventurers, We have verified the following issue: ${formData.issueDescription || '[Issue description]'}. We apologize for any inconvenience caused. The problem is currently being fixed and we will notify you when it is resolved.`
    },
    'daily-restart': {
      name: '日常重启更新公告 / Daily Restart Update Announcement',
      prompt: `Generate a daily restart update announcement with:
- Restart time: ${formData.restartTime || 'TBD'}
- Fixed issues: ${formData.fixes || 'See below'}

Write in this style:
Chinese: 亲爱的冒险者，我们已于${formData.restartTime || '时间'}日常重启服务器时修复如下问题：${formData.fixes || '[修复内容]'}。对于给您造成的不便，我们深表歉意。如有问题请随时联系我们，祝您游戏愉快！

English: Dear Adventurers, we have fixed the following issues during the daily restart of the server at ${formData.restartTime || 'time'}: ${formData.fixes || '[fixed issues]'}. We apologize for any inconvenience caused. Please feel free to contact us if you have any questions, and enjoy the game!`
    },
    'temp-maintenance-preview': {
      name: '临时维护预告 / Temporary Maintenance Preview',
      prompt: `Generate a temporary maintenance preview announcement with:
- Issue reason: ${formData.reason || 'See below'}
- Maintenance time: ${formData.maintenanceTime || 'TBD'}
- Duration: ${formData.duration || 'TBD'} hours
- Estimated reopen: ${formData.reopenTime || 'TBD'}

Write in this style:
Chinese: 亲爱的冒险者，目前我们核实到${formData.reason || '[问题原因]'}，为了尽快修复此问题，我们将会在${formData.maintenanceTime || '[维护时间]'}进行服务器维护，预计维护时间${formData.duration || 'X'}小时，开服时间为${formData.reopenTime || '[开服时间]'}。对于给您造成的不便，我们深表歉意。

English: Dear Adventurers, we have identified ${formData.reason || '[issue reason]'}, and to fix this issue as soon as possible, we will carry out server maintenance at ${formData.maintenanceTime || '[maintenance time]'}, expected to last for ${formData.duration || 'X'} hours, with reopening at ${formData.reopenTime || '[reopen time]'} (UTC+8). We apologize for the inconvenience caused.`
    },
    'temp-maintenance': {
      name: '临时维护公告 / Temporary Maintenance Announcement',
      prompt: `Generate a temporary maintenance announcement with:
- Issue: ${formData.impact || 'Unable to log into the game'}
- Start time: ${formData.startTime || 'TBD'}
- Estimated end: ${formData.endTime || 'TBD'}

Write in this style:
Chinese: 亲爱的冒险者，由于${formData.impact || '[问题]'}，目前玩家无法正常登录游戏。因此我们将对服务器进行临时维护。
维护时间：${formData.startTime || '[开始时间]'} 至 ${formData.endTime || '[结束时间]'}
根据维护进度，维护时间可能会有所延长。维护进度早于预期完成，会提前结束维护，开放登入。给玩家造成不便，我们深表歉意。

English: Dear Adventurers, Due to ${formData.impact || '[issue]'}, players are currently unable to log into the game. The server is undergoing temporary maintenance from ${formData.startTime || '[start time]'} to ${formData.endTime || '[end time]'} (UTC+8).
Please note:
1. The maintenance period may be extended depending on progress.
2. If maintenance is completed ahead of schedule, servers will reopen earlier.
We sincerely apologize for any inconvenience this may cause.`
    },
    'resource-update': {
      name: '资源更新公告 / Resource Update Announcement',
      prompt: `Generate a resource update announcement with:
- Update time: ${formData.updateTime || 'TBD'}
- Resource version: ${formData.resourceVersion || 'TBD'}
- Fixed issues: ${formData.fixes || 'See below'}

Write in this style:
Chinese: 亲爱的冒险者，我们已于${formData.updateTime || '[时间]'}推出新的资源。新资源号：${formData.resourceVersion || '[资源号]'}。本次资源更新将修复如下问题：${formData.fixes || '[修复内容]'}。祝您游戏愉快！

English: Dear Adventurers, We have launched a new resource at ${formData.updateTime || '[update time]'} (UTC+8). New Resource: ${formData.resourceVersion || '[version]'}. This resource update will fix the following issues: ${formData.fixes || '[fixed issues]'}. Enjoy your game!`
    },
    'compensation': {
      name: '补偿邮件 / Compensation Package',
      prompt: `Generate a compensation email with:
- Package contents: ${formData.contents || 'See below'}

Write EXACTLY in this format (replace placeholders with actual items):

Subject: Compensation Package

Dear Adventurer,

We have recently made some fixes and appreciate your patience during this period.
As a token of our apology, we have sent a small compensation package to your in-game mailbox. Please check your mail and enjoy the rewards!

Package Contents:
${formData.contents || '[items]'}

Friendly Reminder:
- The mail will be automatically deleted in 7 days. Please claim the rewards in time.
- Ensure you have sufficient storage space before claiming to avoid any failures.
- Only one character per account is eligible to claim this compensation package.

Sincerely,
Teon: Revelation Team`
    },
    'client-update-reminder': {
      name: '客户端更新提醒 / Client Update Reminder',
      prompt: `Generate a client update reminder announcement with:
- Restart date: ${formData.date || 'TBD'}
- Restart time: ${formData.time || 'TBD'}
- Version: ${formData.version || 'TBD'}

Write EXACTLY in this format (replace placeholders with actual values):

亲爱的冒险者，
Teon: Revelation 将于服务器时间${formData.date || '【日期】'} ${formData.time || '【时间】'}进行服务器重启并强制更新客户端版本至${formData.version || '【版本号】'}。重启后，旧版本客户端将无法进入游戏。
为确保您的游戏体验不受影响，请务必在服务器重启前完成客户端更新。

▶ 更新方式
- 官网跳转更新：访问 http://teonr.com/ ，点击对应应用商店标识自动跳转下载
- 手动更新：
	Android用户：在Google Play搜索"Teon: Revelation"下载最新版本
	iOS用户：在App Store搜索"Teon: Revelation"下载最新版本
▶ 版本验证
更新完成后，请在游戏登录界面左下角确认客户端版本号显示为${formData.version || '【版本号】'}或更高版本。

感谢各位冒险者的理解与配合！

---

Title: Client Update Notice

Dear Adventurers,

Teon: Revelation will undergo a server restart and mandatory client update to version ${formData.version || '[version]'} at ${formData.time || '[time]'} on ${formData.date || '[date]'} (Server Time). After the restart, older client versions will no longer be able to access the game.

To ensure your gaming experience is not affected, please complete the client update before the server restart.

▶ How to Update
- Update via Official Website: Visit http://teonr.com/ and click the app store icon to automatically redirect to the download page
- Manual Update:
Android users: Search "Teon: Revelation" on Google Play to download the latest version
iOS users: Search "Teon: Revelation" on the App Store to download the latest version

▶ Version Verification
After updating, please verify that the client version displayed in the bottom-left corner of the game login screen is ${formData.version || '[version]'} or higher.

Thank you for your understanding and cooperation!`
    },
    'issue-fix': {
      name: '更新修复公告 / Issue Fix Announcement',
      prompt: `Generate an issue fix announcement with:
- Update date: ${formData.date || 'TBD'}
- Update time: ${formData.time || 'TBD'}
- Fixed issues: ${formData.issues || 'See below'}

Write EXACTLY in this format (replace placeholders with actual values):

亲爱的冒险者，
我们已于服务器时间${formData.date || '【日期】'} ${formData.time || '【时间】'}更新将修复如下问题：
• ${formData.issues || '【问题】'}。
对于给您造成的不便，我们深表歉意。如有问题请随时联系我们，祝您游戏愉快！

---

Dear Adventurers,

We have fixed the following issues in the update at ${formData.time || '[time]'} on ${formData.date || '[date]'} (Server Time):
• ${formData.issues || '[fixed issues]'}.

We apologize for any inconvenience caused. If you have any questions, please feel free to contact us. Enjoy the game!`
    }
  };

  const template = templates[type];
  if (!template) {
    throw new Error(`Unknown announcement type: ${type}`);
  }

  return `${glossaryContext}

Please generate a ${template.name} announcement using the information provided.

${template.prompt}

Output format (use exactly these labels):
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
    console.warn('Glossary is empty or not provided');
    return '';
  }

  console.log(`Building glossary context from ${glossary.length} entries`);

  // Sort by Chinese term length (shorter terms first - they're more common)
  // Then take top 1500 to stay within token limits while covering most common terms
  const sortedGlossary = [...glossary].sort((a, b) => (a.cn?.length || 0) - (b.cn?.length || 0));

  // Take top 1500 terms
  const selectedGlossary = sortedGlossary.slice(0, 1500);

  // Debug: Check if common terms are included
  const commonTerms = ['布伦丹', '冒险者', '维护', '血盟', '转生'];
  const foundTerms = commonTerms.filter(term =>
    selectedGlossary.some(t => t.cn === term)
  );
  console.log(`Common terms found in glossary context:`, foundTerms);

  const glossaryItems = selectedGlossary
    .map(item => `- ${item.cn} → ${item.en}`)
    .join('\n');

  console.log(`Glossary context includes ${glossaryItems.split('\n').length} terms`);

  return `Game Terminology Glossary (CRITICAL: MUST use these exact translations):
${glossaryItems}`;
}

/**
 * Parse AI response into structured result
 */
function parseAnnouncementResult(result) {
  console.log('AI Response:', result.slice(0, 500));

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
        console.log('Parsed', currentSection, ':', parsed[currentSection]);
      }
      currentSection = 'cnTitle';
      currentContent = [trimmed.replace(/中文标题[：:]\s*/, '')];
    } else if (trimmed.startsWith('中文内容:') || trimmed.startsWith('中文内容：')) {
      if (currentSection) {
        parsed[currentSection] = currentContent.join('\n').trim();
        console.log('Parsed', currentSection, ':', parsed[currentSection]);
      }
      currentSection = 'cnContent';
      currentContent = [trimmed.replace(/中文内容[：:]\s*/, '')];
    } else if (trimmed.startsWith('英文标题:') || trimmed.startsWith('英文标题：')) {
      if (currentSection) {
        parsed[currentSection] = currentContent.join('\n').trim();
        console.log('Parsed', currentSection, ':', parsed[currentSection]);
      }
      currentSection = 'enTitle';
      currentContent = [trimmed.replace(/英文标题[：:]\s*/, '')];
    } else if (trimmed.startsWith('英文内容:') || trimmed.startsWith('英文内容：')) {
      if (currentSection) {
        parsed[currentSection] = currentContent.join('\n').trim();
        console.log('Parsed', currentSection, ':', parsed[currentSection]);
      }
      currentSection = 'enContent';
      currentContent = [trimmed.replace(/英文内容[：:]\s*/, '')];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection) {
    parsed[currentSection] = currentContent.join('\n').trim();
    console.log('Parsed final', currentSection, ':', parsed[currentSection]);
  }

  console.log('Final parsed result:', parsed);
  return parsed;
}
