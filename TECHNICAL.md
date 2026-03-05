# TR Announcement Bot - 技术文档

## 项目概述

**项目名称**: teon-announce-bot
**版本**: 1.0.0
**类型**: Slack Bot - 双语游戏公告生成器
**部署平台**: Vercel (Serverless Functions)
**AI 服务**: Zhipu GLM API

### 核心功能
- 生成 8 种类型的双语（中文/英文）游戏公告
- 使用 Glossary 术语库确保翻译一致性
- 支持编辑中文内容后自动重新翻译
- 一键复制各部分内容到剪贴板
- 移动端友好的 Slack 交互界面

---

## 技术栈

### 后端
- **运行时**: Node.js >= 18.x
- **框架**: Slack Bolt SDK v3.21.1
- **部署**: Vercel Serverless Functions

### AI 服务
- **提供商**: Zhipu AI (智谱AI)
- **模型**: glm-4-flash (默认) / glm-4-plus
- **用途**: 公告生成、中英翻译

### 数据
- **Glossary**: 3922 条游戏术语 (Glossary260210.json)
- **格式**: JSON `[{"cn": "中文", "en": "English"}]`

---

## 项目结构

```
teon-announce-bot/
├── api/                          # Vercel 部署目录
│   ├── index.js                  # 主入口 - Serverless Function
│   ├── Glossary260210.json       # 术语库 (构建时复制)
│   ├── slack.js                  # Slack 处理器 (旧版)
│   └── debug.js                  # 调试工具
│
├── src/                          # 源代码目录 (开发版本)
│   ├── index.js                  # 导出入口
│   ├── functions/
│   │   └── slack.js              # Slack App 初始化
│   ├── handlers/
│   │   ├── announcement.js       # 公告生成处理
│   │   └── edit.js               # 编辑&重翻译处理
│   └── lib/
│       ├── config.js             # 配置管理
│       ├── glossary.js           # Glossary 加载器
│       ├── slack.js              # Slack Block Kit 构建器
│       └── zhipu.js              # Zhipu GLM API 客户端
│
├── data/
│   └── Glossary260210.json       # 源 Glossary 文件
│
├── scripts/
│   └── copy-glossary.js          # 构建脚本: 复制 Glossary 到 api/
│
├── tools/
│   ├── convert-glossary.js       # Excel 转 JSON 工具
│   └── README.md
│
├── public/
│   └── index.html                # Vercel 静态输出占位
│
├── vercel.json                   # Vercel 配置
├── package.json
├── README.md
└── TECHNICAL.md                  # 本文档
```

---

## Slack 命令

### 1. `/announce` - 生成公告
**工作流程**:
```
用户输入 /announce
    ↓
选择公告类型 (8种按钮选项)
    ↓
发送模板到当前频道 (仅用户可见)
    ↓
用户编辑【】占位符内容
    ↓
使用 /translate 翻译
```

### 2. `/translate` - 翻译公告
**格式**:
```
/translate 标题: [中文标题]
内容: [中文内容]
```

**可选字段**:
```
英文标题: [固定英文标题]  # 不翻译，直接使用
```

---

## 公告类型

| # | 类型 ID | 中文名称 | 英文名称 | 图标 |
|---|---------|----------|----------|------|
| 1 | `maintenance-preview` | 维护预告 | Maintenance Preview | 🔧 |
| 2 | `known-issue` | 已知问题 | Known Issue | ⚠️ |
| 3 | `daily-restart` | 日常重启更新 | Daily Restart Update | 🔄 |
| 4 | `temp-maintenance-preview` | 临时维护预告 | Temp Maintenance Preview | ⏰ |
| 5 | `temp-maintenance` | 临时维护 | Temp Maintenance | 🚨 |
| 6 | `resource-update` | 资源更新 | Resource Update | 📦 |
| 7 | `compensation` | 补偿邮件 | Compensation Package | 🎁 |
| 8 | `client-update-reminder` | 客户端更新提醒 | Client Update Notice | 📱 |

---

## 环境变量

| 变量名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| `SLACK_SIGNING_SECRET` | ✅ | Slack 签名密钥 | `xxxxx` |
| `SLACK_BOT_TOKEN` | ✅ | Bot Token (xoxb-) | `xoxb-xxxxx` |
| `SLACK_CLIENT_ID` | ✅ | Slack App Client ID | `xxxxx.xxxxx` |
| `SLACK_CLIENT_SECRET` | ✅ | Slack App Client Secret | `xxxxx` |
| `SLACK_STATE_SECRET` | ✅ | OAuth State 密钥 | 随机字符串 |
| `ZHIPU_API_KEY` | ✅ | 智谱 API Key | `id.secret` |
| `ZHIPU_MODEL` | ❌ | 模型选择 | `glm-4-flash` (默认) |
| `GAME_NAME` | ❌ | 游戏名称 | `Teon: Revelation` |

---

## Vercel 配置

### `vercel.json`
```json
{
  "buildCommand": "node scripts/copy-glossary.js",
  "outputDirectory": "public",
  "functions": {
    "api/index.js": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

**关键说明**:
- `maxDuration: 60` - 翻译 API 需要较长时间
- `buildCommand` - 构建时复制 Glossary 到 api/ 目录
- `outputDirectory: public` - Vercel 需要静态输出目录

---

## API 端点

### Serverless Function 入口
**路径**: `/api`
**方法**: `POST`
**处理流程**:
1. URL 验证 (`url_verification`)
2. Slack 命令处理 (`/announce`, `/translate`)
3. 交互组件处理 (按钮点击)

---

## Glossary 系统

### 加载逻辑
1. 优先级顺序:
   - `api/Glossary260210.json` (Vercel)
   - `data/Glossary260210.json` (本地)
   - `data/glossary.json` (后备)

2. 翻译时使用:
   - 取前 1500 条术语 (按中文长度排序)
   - 构建上下文发送给 AI

### 更新 Glossary
```bash
# 1. 更新 data/Glossary260210.json
# 2. 运行构建脚本
npm run build

# 3. 提交并推送
git add .
git commit -m "Update glossary"
git push
```

---

## 翻译 API 集成

### Zhipu GLM 调用流程
```javascript
// 1. 构建 JWT Token
generateJWT(apiKeyId, apiKeySecret)

// 2. 调用 API
fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: glossaryContext },
      { role: 'user', content: textToTranslate }
    ]
  })
})
```

### 特殊处理
1. **固定英文标题**: 模板中包含 `英文标题:` 字段时，直接使用不翻译
2. **Glossary 注入**: 前 1500 条术语作为系统提示
3. **超时处理**: Vercel 函数超时设为 60 秒

---

## 关键代码模块

### 1. `api/index.js` - 主入口
- Slack 命令路由
- 翻译逻辑处理
- 公告类型配置 (模板数组)

### 2. `src/lib/slack.js` - Slack Block Kit
- `buildTypeSelectionModal()` - 类型选择界面
- `buildFormModal(type)` - 表单界面
- `buildAnnouncementResult()` - 结果展示

### 3. `src/lib/zhipu.js` - AI 客户端
- `callZhipuAPI()` - API 调用
- `buildGlossaryContext()` - 术语上下文
- `translateToEnglish()` - 翻译功能

### 4. `src/handlers/announcement.js`
- `/announce` 命令处理
- 表单提交处理
- 模板生成路由

---

## 部署流程

### 首次部署
```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量 (在 Vercel 后台)

# 3. 推送代码
git push origin main

# 4. Vercel 自动部署
```

### 更新 Glossary
```bash
# 1. 替换 data/Glossary260210.json

# 2. 本地测试
npm run build

# 3. 提交推送
git add data/Glossary260210.json
git commit -m "Update glossary"
git push

# 4. Vercel 自动重新部署
```

---

## 故障排查

### 1. 翻译超时
**症状**: 一直显示"正在翻译"
**原因**: Vercel 函数超时
**解决**: 已设置 `maxDuration: 60`

### 2. Glossary 未生效
**症状**: 翻译不使用术语
**原因**:
- Glossary 条目超过 1500 条限制
- 术语排序后超出范围

**解决**:
- 检查术语位置（按长度排序）
- 调整 `src/lib/zhipu.js` 中的 limit

### 3. 移动端无法复制
**症状**: 只能复制"模板"二字
**原因**: Slack 移动端只复制 `text` 字段
**解决**: 确保模板内容在 `text` 字段中

---

## 开发指南

### 本地运行
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建测试
npm run build
```

### 添加新公告类型
1. **更新 `api/index.js`**:
   ```javascript
   {
     id: 'new-type',
     name: '新类型',
     emoji: '🆕',
     template: `标题: xxx\n英文标题: xxx\n内容: xxx`
   }
   ```

2. **更新 `src/lib/slack.js`**:
   - 添加按钮到 `buildTypeSelectionModal()`
   - 添加表单到 `buildFormModal()`
   - 添加类型标签到 `buildAnnouncementResult()`

3. **更新 `src/lib/zhipu.js`**:
   - 添加模板到 `templates` 对象

4. **提交并推送**

---

## 成本估算

| 项目 | 月成本 |
|------|--------|
| Vercel Hosting | ¥0 (免费版) |
| Slack App | ¥0 (免费版) |
| Zhipu GLM API | ~¥0.5-1 |

**总计**: ~¥0.5-1/月 (假设每月 150 条公告)

---

## 维护清单

### 每月
- [ ] 检查 Zhipu API 账户余额
- [ ] 查看 Vercel 部署日志

### 按需
- [ ] 更新 Glossary 术语库
- [ ] 添加新的公告类型
- [ ] 调整翻译提示词
- [ ] 优化术语匹配逻辑

### 紧急
- [ ] 翻译失败时检查 API Key
- [ ] 部署失败时检查构建日志
- [ ] Bot 无响应时检查 Slack 配置

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-03 | 初始版本 |
| 1.1.0 | 2025-03 | 添加客户端更新提醒类型 |
| 1.2.0 | 2025-03 | 增加超时到 60s，支持固定英文标题 |

---

## 联系方式

- **仓库**: https://github.com/beryl007/tr-announce-bot
- **部署**: https://tr-announce-bot-v1.vercel.app
- **文档**: 本文件
