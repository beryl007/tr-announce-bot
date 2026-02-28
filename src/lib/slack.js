/**
 * Slack Block Kit builders
 */

/**
 * Build announcement type selection modal
 */
export function buildTypeSelectionModal() {
  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: '选择公告类型 / Select Announcement Type'
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '请选择要生成的公告类型：\nPlease select the announcement type to generate:'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*公告类型 / Announcement Types*'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'select_maintenance_preview',
            text: {
              type: 'plain_text',
              text: '维护预告'
            },
            value: 'maintenance-preview',
            style: 'primary'
          },
          {
            type: 'button',
            action_id: 'select_known_issue',
            text: {
              type: 'plain_text',
              text: '已知问题'
            },
            value: 'known-issue'
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'select_daily_restart',
            text: {
              type: 'plain_text',
              text: '日常重启更新'
            },
            value: 'daily-restart'
          },
          {
            type: 'button',
            action_id: 'select_temp_maintenance_preview',
            text: {
              type: 'plain_text',
              text: '临时维护预告'
            },
            value: 'temp-maintenance-preview'
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'select_temp_maintenance',
            text: {
              type: 'plain_text',
              text: '临时维护公告'
            },
            value: 'temp-maintenance',
            style: 'danger'
          },
          {
            type: 'button',
            action_id: 'select_resource_update',
            text: {
              type: 'plain_text',
              text: '资源更新'
            },
            value: 'resource-update'
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'select_compensation',
            text: {
              type: 'plain_text',
              text: '补偿邮件'
            },
            value: 'compensation',
            style: 'primary'
          }
        ]
      }
    ]
  };
}

/**
 * Build form modal for each announcement type
 */
export function buildFormModal(type) {
  const forms = {
    'maintenance-preview': {
      title: '维护预告 / Maintenance Preview',
      blocks: [
        {
          type: 'input',
          block_id: 'date',
          label: {
            type: 'plain_text',
            text: '维护日期 / Maintenance Date'
          },
          element: {
            type: 'datepicker',
            action_id: 'date_value',
            placeholder: {
              type: 'plain_text',
              text: 'Select date'
            }
          }
        },
        {
          type: 'input',
          block_id: 'start_time',
          label: {
            type: 'plain_text',
            text: '开始时间 / Start Time'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'time_value',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., 14:00'
            }
          },
          hint: {
            type: 'plain_text',
            text: '格式: 14:00 (24小时制) / Format: 14:00 (24-hour)'
          }
        },
        {
          type: 'input',
          block_id: 'duration',
          label: {
            type: 'plain_text',
            text: '预计时长 / Duration (hours)'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'duration_value',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., 4'
            }
          }
        },
        {
          type: 'input',
          block_id: 'notes',
          label: {
            type: 'plain_text',
            text: '备注 / Notes (optional)'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'notes_value',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Optional additional information'
            }
          },
          optional: true
        }
      ]
    },
    'known-issue': {
      title: '已知问题公告 / Known Issue',
      blocks: [
        {
          type: 'input',
          block_id: 'issue_description',
          label: {
            type: 'plain_text',
            text: '问题描述 / Issue Description'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'description_value',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Describe the issue...'
            }
          }
        },
        {
          type: 'input',
          block_id: 'solution',
          label: {
            type: 'plain_text',
            text: '处理方案 / Solution'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'solution_value',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'How will this be resolved?'
            }
          },
          optional: true
        }
      ]
    },
    'daily-restart': {
      title: '日常重启更新 / Daily Restart Update',
      blocks: [
        {
          type: 'input',
          block_id: 'restart_date',
          label: {
            type: 'plain_text',
            text: '重启日期 / Restart Date'
          },
          element: {
            type: 'datepicker',
            action_id: 'date_value'
          }
        },
        {
          type: 'input',
          block_id: 'restart_time',
          label: {
            type: 'plain_text',
            text: '重启时间 / Restart Time'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'time_value',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., 10:00'
            }
          }
        },
        {
          type: 'input',
          block_id: 'fixes',
          label: {
            type: 'plain_text',
            text: '修复内容 / Fixed Issues'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'fixes_value',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'List the issues fixed...'
            }
          }
        }
      ]
    },
    'temp-maintenance-preview': {
      title: '临时维护预告 / Temporary Maintenance Preview',
      blocks: [
        {
          type: 'input',
          block_id: 'reason',
          label: {
            type: 'plain_text',
            text: '问题原因 / Issue Reason'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'reason_value',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'What is the issue?'
            }
          }
        },
        {
          type: 'input',
          block_id: 'maintenance_date',
          label: {
            type: 'plain_text',
            text: '维护日期 / Maintenance Date'
          },
          element: {
            type: 'datepicker',
            action_id: 'date_value'
          }
        },
        {
          type: 'input',
          block_id: 'start_time',
          label: {
            type: 'plain_text',
            text: '开始时间 / Start Time'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'time_value',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., 12:00'
            }
          }
        },
        {
          type: 'input',
          block_id: 'duration',
          label: {
            type: 'plain_text',
            text: '预计时长 / Duration (hours)'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'duration_value',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., 2'
            }
          }
        }
      ]
    },
    'temp-maintenance': {
      title: '临时维护公告 / Temporary Maintenance',
      blocks: [
        {
          type: 'input',
          block_id: 'start_time',
          label: {
            type: 'plain_text',
            text: '开始时间 / Start Time'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'start_time_value',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., March 7, 2025, 12:00'
            }
          },
          hint: {
            type: 'plain_text',
            text: 'Full datetime format / 完整日期时间格式'
          }
        },
        {
          type: 'input',
          block_id: 'end_time',
          label: {
            type: 'plain_text',
            text: '预计结束时间 / Estimated End Time'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'end_time_value',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., 14:30'
            }
          }
        },
        {
          type: 'input',
          block_id: 'impact',
          label: {
            type: 'plain_text',
            text: '维护影响 / Impact'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'impact_value',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'e.g., Unable to log into the game'
            }
          }
        }
      ]
    },
    'resource-update': {
      title: '资源更新公告 / Resource Update',
      blocks: [
        {
          type: 'input',
          block_id: 'update_date',
          label: {
            type: 'plain_text',
            text: '更新日期 / Update Date'
          },
          element: {
            type: 'datepicker',
            action_id: 'date_value'
          }
        },
        {
          type: 'input',
          block_id: 'update_time',
          label: {
            type: 'plain_text',
            text: '更新时间 / Update Time'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'time_value',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., 10:00'
            }
          }
        },
        {
          type: 'input',
          block_id: 'resource_version',
          label: {
            type: 'plain_text',
            text: '资源号 / Resource Version'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'version_value',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., 1.2.3'
            }
          }
        },
        {
          type: 'input',
          block_id: 'fixes',
          label: {
            type: 'plain_text',
            text: '修复内容 / Fixed Issues'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'fixes_value',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'List the issues fixed...'
            }
          }
        }
      ]
    },
    'compensation': {
      title: '补偿邮件 / Compensation Package',
      blocks: [
        {
          type: 'input',
          block_id: 'contents',
          label: {
            type: 'plain_text',
            text: '物品列表 / Package Contents'
          },
          element: {
            type: 'plain_text_input',
            action_id: 'contents_value',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'List the compensation items...'
            }
          }
        }
      ]
    }
  };

  const form = forms[type];
  if (!form) {
    throw new Error(`Unknown form type: ${type}`);
  }

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: form.title
    },
    submit: {
      type: 'plain_text',
      text: '生成公告 / Generate'
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*请填写以下信息 / Please fill in the following information:*'
        }
      },
      ...form.blocks,
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 提示: 所有时间将自动添加【服务器时间】/(UTC+8)标识'
          }
        ]
      }
    ]
  };
}

/**
 * Build announcement result message
 */
export function buildAnnouncementResult(result, type) {
  const typeLabels = {
    'maintenance-preview': '维护预告 / Maintenance Preview',
    'known-issue': '已知问题公告 / Known Issue',
    'daily-restart': '日常重启更新 / Daily Restart Update',
    'temp-maintenance-preview': '临时维护预告 / Temporary Maintenance Preview',
    'temp-maintenance': '临时维护公告 / Temporary Maintenance',
    'resource-update': '资源更新公告 / Resource Update',
    'compensation': '补偿邮件 / Compensation Package'
  };

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `✅ 公告已生成 / Announcement Generated`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*类型 / Type:* ${typeLabels[type] || type}`
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📢 中文标题 / Chinese Title*\n${result.cnTitle || ''}`
        },
        accessory: {
          type: 'button',
          action_id: 'copy_cn_title',
          text: {
            type: 'plain_text',
            text: '📋 复制'
          },
          value: JSON.stringify({ type, part: 'cnTitle', content: result.cnTitle || '' })
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📝 中文内容 / Chinese Content*\n\`\`\`${result.cnContent || ''}\`\`\``
        },
        accessory: {
          type: 'button',
          action_id: 'copy_cn_content',
          text: {
            type: 'plain_text',
            text: '📋 复制'
          },
          value: JSON.stringify({ type, part: 'cnContent', content: result.cnContent || '' })
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📢 英文标题 / English Title*\n${result.enTitle || ''}`
        },
        accessory: {
          type: 'button',
          action_id: 'copy_en_title',
          text: {
            type: 'plain_text',
            text: '📋 Copy'
          },
          value: JSON.stringify({ type, part: 'enTitle', content: result.enTitle || '' })
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📝 英文内容 / English Content*\n\`\`\`${result.enContent || ''}\`\`\``
        },
        accessory: {
          type: 'button',
          action_id: 'copy_en_content',
          text: {
            type: 'plain_text',
            text: '📋 Copy'
          },
          value: JSON.stringify({ type, part: 'enContent', content: result.enContent || '' })
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'edit_chinese',
            text: {
              type: 'plain_text',
              text: '✏️ 编辑中文 / Edit Chinese'
            },
            value: JSON.stringify({ type, currentData: result }),
            style: 'primary'
          },
          {
            type: 'button',
            action_id: 'regenerate',
            text: {
              type: 'plain_text',
              text: '🔄 重新生成 / Regenerate'
            },
            value: type
          },
          {
            type: 'button',
            action_id: 'done',
            text: {
              type: 'plain_text',
              text: '✓ 完成 / Done'
            },
            value: type
          }
        ]
      }
    ],
    // Fallback text for notifications
    text: `公告已生成\n\n中文标题: ${result.cnTitle}\n中文内容: ${result.cnContent}\n英文标题: ${result.enTitle}\n英文内容: ${result.enContent}`
  };
}

/**
 * Build copy confirmation DM
 */
export function buildCopyDM(part, content) {
  const labels = {
    cnTitle: '📢 中文标题 / Chinese Title',
    cnContent: '📝 中文内容 / Chinese Content',
    enTitle: '📢 英文标题 / English Title',
    enContent: '📝 英文内容 / English Content'
  };

  return {
    text: `${labels[part]}\n\n──────────────────\n\n${content}\n\n──────────────────\n\n✅ 已准备好复制，请选择上方文本复制 / Ready to copy, select text above to copy`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${labels[part]}\n\n──────────────────\n\n\`\`\`${content}\`\`\`\n\n──────────────────\n\n✅ 请复制上方内容 / Please copy the content above`
        }
      }
    ]
  };
}

/**
 * Build edit modal for Chinese content
 */
export function buildEditModal(type, currentData) {
  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: '编辑中文 / Edit Chinese'
    },
    submit: {
      type: 'plain_text',
      text: '保存并翻译 / Save & Translate'
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '编辑中文内容，保存后将自动翻译更新英文版本\nEdit Chinese content, English will be auto-translated after saving.'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'input',
        block_id: 'cn_title',
        label: {
          type: 'plain_text',
          text: '中文标题 / Chinese Title'
        },
        element: {
          type: 'plain_text_input',
          action_id: 'title_value',
          initial_value: currentData.cnTitle || ''
        }
      },
      {
        type: 'input',
        block_id: 'cn_content',
        label: {
          type: 'plain_text',
          text: '中文内容 / Chinese Content'
        },
        element: {
          type: 'plain_text_input',
          action_id: 'content_value',
          initial_value: currentData.cnContent || '',
            multiline: true
          }
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 提示: 可以复制原内容粘贴修改，或直接编辑'
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*当前英文版本 / Current English Version:*'
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `标题: ${currentData.enTitle || 'N/A'}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `内容:\n${currentData.enContent?.substring(0, 200) || 'N/A'}${currentData.enContent?.length > 200 ? '...' : ''}`
          }
        ]
      }
    ],
    private_metadata: JSON.stringify({ type, originalData: currentData })
  };
}

/**
 * Build loading message
 */
export function buildLoadingMessage(message = '生成中... / Generating...') {
  return {
    text: message,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⏳ ${message}`
        }
      }
    ]
  };
}

/**
 * Build error message
 */
export function buildErrorMessage(error) {
  return {
    text: `❌ 生成失败 / Error: ${error.message}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *生成失败 / Generation Error*\n\n\`${error.message}\`\n\n请重试或联系管理员 / Please retry or contact admin`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'retry',
            text: {
              type: 'plain_text',
              text: '🔄 重试 / Retry'
            },
            value: 'retry'
          }
        ]
      }
    ]
  };
}

/**
 * Parse form data from modal submission
 */
export function parseFormData(view, type) {
  const state = view.state || {};
  const values = state.values || {};
  const formData = {};

  // Helper to get input value
  const getValue = (blockId, actionId = 'value') => {
    try {
      const block = values[blockId];
      if (!block) return '';
      const action = block[actionId] || block[`${actionId}_value`] || block[Object.keys(block)[0]];
      return action?.value || action?.selected_date_time || '';
    } catch {
      return '';
    }
  };

  // Parse based on type
  switch (type) {
    case 'maintenance-preview':
      formData.date = getValue('date', 'date_value');
      formData.startTime = getValue('start_time', 'time_value');
      formData.duration = getValue('duration', 'duration_value');
      formData.notes = getValue('notes', 'notes_value');
      // Calculate estimated reopen time
      if (formData.date && formData.startTime && formData.duration) {
        formData.reopenTime = calculateReopenTime(formData.date, formData.startTime, formData.duration);
      }
      break;

    case 'known-issue':
      formData.issueDescription = getValue('issue_description', 'description_value');
      formData.solution = getValue('solution', 'solution_value');
      break;

    case 'daily-restart':
      formData.restartTime = `${getValue('restart_date', 'date_value')} ${getValue('restart_time', 'time_value')}`;
      formData.fixes = getValue('fixes', 'fixes_value');
      break;

    case 'temp-maintenance-preview':
      formData.reason = getValue('reason', 'reason_value');
      formData.maintenanceTime = `${getValue('maintenance_date', 'date_value')} ${getValue('start_time', 'time_value')}`;
      formData.duration = getValue('duration', 'duration_value');
      if (formData.maintenanceTime && formData.duration) {
        const parts = formData.maintenanceTime.split(' ');
        formData.reopenTime = calculateReopenTime(parts[0], parts[1] || '00:00', formData.duration);
      }
      break;

    case 'temp-maintenance':
      formData.startTime = getValue('start_time', 'start_time_value');
      formData.endTime = getValue('end_time', 'end_time_value');
      formData.impact = getValue('impact', 'impact_value');
      break;

    case 'resource-update':
      formData.updateTime = `${getValue('update_date', 'date_value')} ${getValue('update_time', 'time_value')}`;
      formData.resourceVersion = getValue('resource_version', 'version_value');
      formData.fixes = getValue('fixes', 'fixes_value');
      break;

    case 'compensation':
      formData.contents = getValue('contents', 'contents_value');
      break;
  }

  return formData;
}

/**
 * Calculate reopen time based on start time and duration
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
