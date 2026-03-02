import { buildTypeSelectionModal, buildFormModal, buildAnnouncementResult, buildCopyDM, buildLoadingMessage, buildErrorMessage, parseFormData } from '../lib/slack.js';
import { generateAnnouncement } from '../lib/zhipu.js';
import { loadGlossary } from '../lib/glossary.js';

// Store for pending form data (in production, use Redis or database)
const pendingForms = new Map();

/**
 * Initialize announcement handlers
 */
export function initAnnouncementHandlers(app) {
  // Handle /announce command
  app.command('/announce', async ({ command, ack, client, body }) => {
    await ack();

    try {
      // Open type selection modal
      await client.views.open({
        trigger_id: body.trigger_id,
        view: buildTypeSelectionModal()
      });
    } catch (error) {
      console.error('Error opening type selection modal:', error);
      await client.chat.postMessage({
        channel: body.channel_id,
        ...buildErrorMessage(error)
      });
    }
  });

  // Handle announcement type selection
  app.action(/select_(.+)/, async ({ body, action, ack, client }) => {
    await ack();

    const type = action.value;
    const triggerId = body.trigger_id;
    const channelId = body.channel?.id || body.container?.channel_id || body.channel_id;

    try {
      // Build form modal with channel_id in metadata
      const view = buildFormModal(type);
      view.private_metadata = JSON.stringify({ type, channelId });

      await client.views.open({
        trigger_id: triggerId,
        view: view
      });
    } catch (error) {
      console.error('Error opening form modal:', error);
      await client.chat.postMessage({
        channel: channelId,
        ...buildErrorMessage(error)
      });
    }
  });

  // Handle form submission
  app.view({ callback_id: 'announcement_form', type: 'view_submission' }, async ({ ack, body, view, client }) => {
    await ack();

    // Parse metadata to get type and channel_id
    let type = 'maintenance-preview';
    let channelId = null;

    try {
      const metadata = JSON.parse(view.private_metadata || '{}');
      type = metadata.type || extractTypeFromBlocks(view.blocks);
      channelId = metadata.channelId;
    } catch (e) {
      type = view.private_metadata || extractTypeFromBlocks(view.blocks);
    }

    const userId = body.user.id;

    // If no channel_id, open DM
    let targetChannel = channelId;
    if (!targetChannel) {
      try {
        const dm = await client.conversations.open({ users: userId });
        targetChannel = dm.channel.id;
      } catch (dmError) {
        console.error('Failed to open DM:', dmError);
        // Still try to use the channel
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

      // Store for potential editing
      pendingForms.set(`${userId}_${Date.now()}`, { type, result, formData });

    } catch (error) {
      console.error('Error generating announcement:', error);
      await client.chat.postMessage({
        channel: channelId,
        ...buildErrorMessage(error)
      });
    }
  });

  // Handle copy button clicks
  app.action(/copy_(.+)/, async ({ body, action, ack, client }) => {
    await ack();

    try {
      const data = JSON.parse(action.value);
      const userId = body.user.id;

      // Open DM with copied content
      const dm = await client.conversations.open({
        users: userId
      });

      await client.chat.postMessage({
        channel: dm.channel.id,
        ...buildCopyDM(data.part, data.content)
      });

      // Send ephemeral confirmation
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: '✅ 已发送到私信 / Sent to DM ✓'
      });
    } catch (error) {
      console.error('Error handling copy:', error);
    }
  });

  // Handle regenerate button
  app.action('regenerate', async ({ body, action, ack, client }) => {
    await ack();

    const type = action.value;
    const triggerId = body.trigger_id;
    const channelId = body.channel?.id || body.container?.channel_id;

    try {
      const view = buildFormModal(type);
      view.private_metadata = JSON.stringify({ type, channelId });

      await client.views.open({
        trigger_id: triggerId,
        view: view
      });
    } catch (error) {
      console.error('Error opening form for regeneration:', error);
    }
  });

  // Handle done button
  app.action('done', async ({ body, action, ack, client }) => {
    await ack();

    // Post a completion message
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: '✅ 完成！如需重新生成，请使用 /announce / Done! Use /announce to regenerate'
    });
  });
}

/**
 * Extract announcement type from view blocks (fallback)
 */
function extractTypeFromBlocks(blocks) {
  for (const block of blocks) {
    if (block.type === 'input' && block.label?.text) {
      const text = block.label.text.toLowerCase();
      if (text.includes('maintenance')) return 'maintenance-preview';
      if (text.includes('known issue')) return 'known-issue';
      if (text.includes('daily restart')) return 'daily-restart';
      if (text.includes('temporary maintenance preview')) return 'temp-maintenance-preview';
      if (text.includes('temporary maintenance') && !text.includes('preview')) return 'temp-maintenance';
      if (text.includes('resource')) return 'resource-update';
      if (text.includes('compensation')) return 'compensation';
    }
  }
  return 'maintenance-preview'; // Default
}
