# Teon: Revelation Announcement Bot

Slack bot for generating bilingual game announcements using Zhipu GLM AI.

## Features

- 📝 Generate 7 types of bilingual announcements
- 🔄 Edit Chinese content and auto-translate English
- 📋 Copy individual sections (title/content in CN/EN)
- 📚 Game terminology consistency via glossary
- 🤖 Powered by Zhipu GLM (very low cost)

## Announcement Types

| # | 中文 | English |
|---|------|---------|
| 1 | 维护预告 | Maintenance Preview |
| 2 | 已知问题公告 | Known Issue Announcement |
| 3 | 日常重启更新公告 | Daily Restart Update Announcement |
| 4 | 临时维护预告 | Temporary Maintenance Preview |
| 5 | 临时维护公告 | Temporary Maintenance Announcement |
| 6 | 资源更新公告 | Resource Update Announcement |
| 7 | 补偿邮件 | Compensation Package |

---

## YOU MUST DO: Setup Instructions

### Step 1: Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Enter:
   - **App name**: `Teon Announcement Bot`
   - **Pick a workspace**: Select your workspace
4. Click **Create App**

### Step 2: Configure Slack App

1. **Basic Information** → Scroll to **Display Information**
   - Add App name, Description, etc.
   - Upload an icon (optional)

2. **OAuth & Permissions**
   - Scroll to **Scopes** → **Bot Token Scopes**
   - Add these scopes:
     ```
     chat:write
     chat:write.public
     commands
     im:write
     files:write
     ```

3. **App-Level Tokens**
   - Click **Create an App-Level Token**
   - Name: `app-level-token`
   - Scope: `app-level-token`
   - Save the token

4. **Install to Workspace**
   - Scroll to **OAuth Tokens for Your Workspace**
   - Click **Install to Workspace**
   - Copy these values:
     - **Bot User OAuth Token** → `SLACK_BOT_TOKEN`
     - **Signing Secret** (under Basic Information) → `SLACK_SIGNING_SECRET`

5. **Create Slash Command**
   - Go to **Slash Commands**
   - Click **Create New Command**
   - Command: `/announce`
   - Request URL: `https://your-app.vercel.app/slack/commands` (we'll update this later)
   - Description: `Generate game announcements`
   - Save

6. **Get Client ID/Secret**
   - Go to **Basic Information**
   - Copy **Client ID** → `SLACK_CLIENT_ID`
   - Copy **Client Secret** → `SLACK_CLIENT_SECRET`

### Step 3: Get Zhipu GLM API Key

1. Go to [open.bigmodel.cn](https://open.bigmodel.cn/)
2. Register/Login
3. Go to **API Keys**
4. Create new API key
5. Copy the API key → `ZHIPU_API_KEY`

Format: `id.secret` (you'll get this from the platform)

### Step 4: Prepare Glossary

1. **Option A: Convert Excel to JSON**
   ```bash
   pip install pandas openpyxl
   python scripts/excel_to_json.py path/to/Glossary.xlsx
   ```
   This creates `data/glossary.json`

2. **Option B: Manual Edit**
   - Edit `data/glossary.json` directly
   - Format: `[{"cn": "中文", "en": "English"}, ...]`

### Step 5: Deploy to Vercel

1. **Push code to GitHub**
   ```bash
   cd teon-announce-bot
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   # Create repo on GitHub first, then:
   git remote add origin https://github.com/YOUR_USERNAME/teon-announce-bot.git
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com/)
   - Sign up/login with GitHub
   - Click **New Project**
   - Select `teon-announce-bot` repository
   - Click **Import**

3. **Configure Environment Variables**
   - In Vercel project, go to **Settings** → **Environment Variables**
   - Add these variables:

   | Key | Value |
   |-----|-------|
   | `SLACK_SIGNING_SECRET` | From Step 2 |
   | `SLACK_BOT_TOKEN` | From Step 2 (starts with `xoxb-`) |
   | `SLACK_CLIENT_ID` | From Step 2 |
   | `SLACK_CLIENT_SECRET` | From Step 2 |
   | `ZHIPU_API_KEY` | From Step 3 |
   | `SLACK_STATE_SECRET` | Any random string (e.g., `teon-secret-123`) |

4. **Deploy**
   - Click **Deploy**
   - Wait for deployment to complete
   - Note your Vercel URL (e.g., `https://teon-announce-bot.vercel.app`)

5. **Update Slack Command URL**
   - Go back to Slack App settings
   - **Slash Commands** → Edit `/announce`
   - Update Request URL: `https://your-app.vercel.app/slack/commands`
   - Save

### Step 6: Install Bot to Workspace

1. Install the app to your Slack workspace (if not already done)
2. Test with `/announce` command

---

## How to Use

### Generate Announcement

1. In Slack, type `/announce`
2. Select announcement type
3. Fill in the form
4. Click **Generate**
5. Bot posts result with copy buttons

### Copy Content

1. Click **📋 复制** button next to any section
2. Bot sends content to your DM
3. Copy from DM message

### Edit & Re-translate

1. Click **✏️ 编辑中文** button
2. Edit Chinese content
3. Click **Save & Translate**
4. Bot posts updated result

---

## Updating Glossary

When you update the Excel glossary:

1. Run the conversion script:
   ```bash
   python scripts/excel_to_json.py path/to/Glossary.xlsx
   ```

2. Commit and push changes:
   ```bash
   git add data/glossary.json
   git commit -m "Update glossary"
   git push
   ```

3. Vercel will auto-deploy with new glossary

---

## Project Structure

```
teon-announce-bot/
├── src/
│   ├── index.js              # Vercel entry point
│   ├── functions/
│   │   └── slack.js          # Main Slack handler
│   ├── handlers/
│   │   ├── announcement.js   # Announcement handlers
│   │   └── edit.js           # Edit & re-translate handlers
│   └── lib/
│       ├── config.js         # Configuration
│       ├── glossary.js       # Glossary utilities
│       ├── slack.js          # Slack Block Kit builders
│       └── zhipu.js          # Zhipu GLM API client
├── data/
│   └── glossary.json         # Game terminology
├── scripts/
│   └── excel_to_json.py      # Excel to JSON converter
├── vercel.json               # Vercel config
├── package.json
└── README.md
```

---

## Troubleshooting

### Bot not responding
- Check environment variables in Vercel
- Verify Slack command URL matches your Vercel URL
- Check Vercel logs

### Glossary not loading
- Verify `data/glossary.json` exists
- Check file format is valid JSON

### Translation issues
- Verify Zhipu API key is valid
- Check you have sufficient API credits
- Try `glm-4-flash` model (cheaper)

---

## Cost Estimate

| Service | Cost |
|---------|------|
| Vercel Hosting | Free |
| Slack App | Free |
| Zhipu GLM API | ~¥0.5-1/month |

**Total: ~¥0.5-1/month** (assuming 150 announcements/month)

---

## License

Internal use only.
