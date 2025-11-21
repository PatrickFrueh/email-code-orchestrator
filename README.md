# email-code-orchestrator

Automated, event-driven pipeline that extracts verification codes from emails and delivers them via Telegram.

## Features

- 📧 **IMAP Email Monitoring** - Connects to Gmail to fetch new messages
- 🔐 **Smart Code Extraction** - Direct regex matching + link following with context-aware validation
- 🤖 **Browser Automation** - Automated Netflix household confirmations using Puppeteer
- 📱 **Telegram Notifications** - Instant delivery of codes and automation results

## Prerequisites

- Node.js 20+ (LTS)
- pnpm v10+
- Gmail account with 2FA enabled (for App Password)
- Telegram account

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Gmail App Password

Since Gmail requires App Passwords for IMAP access:

1. Enable 2FA on your Google Account: https://myaccount.google.com/security
2. Generate an App Password: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
3. Use this App Password (not your regular password) in `.env`

### 3. Create Telegram Bot

1. **Start a chat with BotFather**: https://t.me/BotFather
2. **Create a new bot**:
   ```
   Send: /newbot
   Follow prompts to choose name and username
   ```
3. **Copy the bot token** (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

4. **Get your Chat ID**:
   - Send `/start` to your bot
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Look for `"chat":{"id":123456789}` in the JSON response
   - Copy the numeric ID

   **Alternative method** (using a helper bot):
   - Message @userinfobot on Telegram
   - It will reply with your chat ID

   **For group chats**:
   - Add your bot to the group
   - Send a message mentioning the bot: `@your_bot_name hello`
   - Visit the getUpdates URL above
   - Look for `"chat":{"id":-1001234567890}` (note the negative number for groups)

### 4. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Email Configuration
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-16-char-app-password

# Netflix Credentials (optional - for household automation)
NETFLIX_EMAIL=your-netflix-email@gmail.com
NETFLIX_PASSWORD=your-netflix-password

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

## Usage

### Run Once (Development)

```bash
pnpm run dev
```

This will:
1. Connect to Gmail IMAP
2. Check for unseen emails
3. Extract verification codes or handle household updates
4. Send notifications to Telegram
5. Exit

### Run Continuously (TODO)

Continuous polling/IDLE listener not yet implemented. Currently runs once and exits.

## How It Works

### Verification Code Extraction

**Strategy 1: Direct Extraction**
- Searches email body for 6-digit codes using regex: `/\b\d{6}\b/g`
- Fast and works for most services (GitHub, Steam, etc.)

**Strategy 2: Link Following**
- Extracts URLs from email HTML
- Filters links containing keywords: "verify", "code", "confirmation"
- Fetches link content via HTTP
- Applies context-aware extraction:
  - Pattern matching: `code: 123456`
  - HTML tag extraction: `<div>123456</div>`
  - Error detection: Rejects pages with "expired", "invalid"
  - Size heuristic: Rejects responses >50KB (likely full apps)
  - Count limit: Only accepts if ≤3 codes found

### Netflix Household Automation

When an email contains "Haushalt" or "Aktualisierung bestätigen":

1. Extract confirmation link from email
2. Launch headless Chrome via Puppeteer
3. Navigate to link (decodes HTML entities)
4. Detect if login required
5. Perform login if needed (tries multiple selector patterns)
6. Search for confirmation button by keywords:
   - German: "Aktualisierung bestätigen"
   - English: "Update household", "Confirm update"
7. Click button (smooth scroll + wait)
8. Verify success message appears
9. Send Telegram notification (✅ success or ❌ failure)

## Project Structure

```
email-code-orchestrator/
├── src/
│   ├── index.ts                    # Main orchestrator, IMAP connection
│   ├── extractor.ts                # Code extraction logic
│   ├── browser-automation.ts       # Puppeteer automation
│   └── messaging/
│       └── telegram.ts             # Telegram notifications
├── .env                            # Your secrets (DO NOT COMMIT)
├── .env.example                    # Template
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
└── README.md                       # This file
```

## Troubleshooting

### "Invalid credentials" error

- Make sure you're using an **App Password**, not your regular Gmail password
- Verify 2FA is enabled on your Google Account
- Generate a new App Password if needed

### "TELEGRAM_BOT_TOKEN not configured"

- Check that `.env` file exists and contains `TELEGRAM_BOT_TOKEN`
- Verify the token format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
- Make sure there are no quotes around the token value

### "Failed to send Telegram notification"

- Verify your bot token is correct
- Check your Chat ID is correct (numeric, no quotes)
- Make sure you've sent `/start` to your bot at least once
- For groups: Ensure the bot is added to the group

### Netflix automation fails

- Verify `NETFLIX_EMAIL` and `NETFLIX_PASSWORD` are set in `.env`
- Netflix may show CAPTCHA (requires manual intervention)
- Run with `headless: false` in `browser-automation.ts` to see what's happening
- Check the console logs for detailed selector matching info

## Development

### Run TypeScript directly

```bash
pnpm run dev
```

### Build for production

```bash
pnpm run build
```

### Run production build

```bash
pnpm start
```

## Pending Features

- [ ] Continuous execution (polling loop or IMAP IDLE)
- [ ] Error recovery and retry logic
- [ ] Config validation with Zod
- [ ] Structured logging with Pino
- [ ] Unit tests with Vitest
- [ ] Docker containerization
- [ ] Deduplication (avoid processing same email twice)

## License

MIT
