import { buildEditModal, buildAnnouncementResult, buildLoadingMessage, buildErrorMessage } from '../lib/slack.js';
import { reTranslateAfterEdit } from '../lib/zhipu.js';
import { loadGlossary } from '../lib/glossary.js';

/**
 * Initialize edit handlers
 */
export function initEditHandlers(app) {
  // Handle edit Chinese button
  app.action('edit_chinese', async ({ body, action, ack, client }) => {
    await ack();

    try {
      const data = JSON.parse(action.value);
      const triggerId = body.trigger_id;

      await client.views.open({
        trigger_id: triggerId,
        view: buildEditModal(data.type, data.currentData)
      });
    } catch (error) {
      console.error('Error opening edit modal:', error);
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: `❌ Error: ${error.message}`
      });
    }
  });

  // Handle edit form submission
  app.view({ callback_id: 'edit_form', type: 'view_submission' }, async ({ ack, body, view, client }) => {
    await ack();

    const userId = body.user.id;
    const channelId = body.user?.channel || body.channel_id;

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
  });
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
