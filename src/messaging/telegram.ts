import { Telegraf } from 'telegraf';

// Lazy initialization - only create bot instance when needed
let bot: Telegraf | null = null;

function getBot(): Telegraf {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured in .env');
    }
    bot = new Telegraf(token);
  }
  return bot;
}

function getChatId(): string {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID not configured in .env');
  }
  return chatId;
}

/**
 * Send verification code notification to Telegram
 * 
 * @param code - The 6-digit verification code
 * @param subject - Email subject line
 * @param sender - Email sender address
 * @example
 * await sendCodeNotification('123456', 'GitHub verification', 'noreply@github.com')
 */
export async function sendCodeNotification(
  code: string,
  subject: string,
  sender: string
): Promise<void> {
  const message = `
🔐 *Verification Code*

Code: \`${code}\`
From: ${sender}
Subject: ${subject}
  `.trim();

  try {
    await getBot().telegram.sendMessage(
      getChatId(),
      message,
      { parse_mode: 'Markdown' }
    );
    console.log('✅ Code notification sent to Telegram');
  } catch (error) {
    console.error('❌ Failed to send Telegram notification:', error);
    throw error;
  }
}

/**
 * Send Netflix household update notification to Telegram
 * 
 * @param success - Whether the update succeeded
 * @param email - Netflix account email
 * @param error - Optional error message if failed
 * @example
 * await sendHouseholdNotification(true, 'user@example.com')
 * await sendHouseholdNotification(false, 'user@example.com', 'Button not found')
 */
export async function sendHouseholdNotification(
  success: boolean,
  email: string,
  error?: string
): Promise<void> {
  const emoji = success ? '✅' : '❌';
  const status = success ? 'SUCCESS' : 'FAILED';

  const message = `
${emoji} *Netflix Household Update*

Status: ${status}
Account: ${email}
${error ? `Error: ${error}` : ''}
  `.trim();

  try {
    await getBot().telegram.sendMessage(
      getChatId(),
      message,
      { parse_mode: 'Markdown' }
    );
    console.log(`✅ Household notification sent to Telegram (${status})`);
  } catch (error) {
    console.error('❌ Failed to send Telegram notification:', error);
    throw error;
  }
}

/**
 * Send generic error notification to Telegram
 * 
 * @param errorMessage - Description of the error
 * @param context - Optional context information (email subject, etc.)
 */
export async function sendErrorNotification(
  errorMessage: string,
  context?: string
): Promise<void> {
  const message = `
⚠️ *Error in Email Code Orchestrator*

Error: ${errorMessage}
${context ? `Context: ${context}` : ''}
  `.trim();

  try {
    await getBot().telegram.sendMessage(
      getChatId(),
      message,
      { parse_mode: 'Markdown' }
    );
    console.log('✅ Error notification sent to Telegram');
  } catch (error) {
    console.error('❌ Failed to send error notification to Telegram:', error);
  }
}
