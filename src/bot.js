const TelegramBot = require("node-telegram-bot-api");
const { BOT_TOKEN, RATE_LIMIT } = require("./config");
const { loadSessions, saveSessions } = require("./utils/sessionStorage");

const userSessions = loadSessions();
const userRequests = {};
let bot;


function checkRateLimit(chatId, command = "") {
  const now = Date.now();
  const userKey = `user_${chatId}`;

  if (
    !userRequests[userKey] ||
    now - userRequests[userKey].windowStart > RATE_LIMIT.WINDOW_MS
  ) {
    userRequests[userKey] = {
      count: 0,
      windowStart: now,
      commandCounts: {},
    };
  }

  const user = userRequests[userKey];

  if (user.count >= RATE_LIMIT.MAX_REQUESTS) {
    
    return {
      allowed: false,
      reason: "⚙️ Подождите немного — бот обрабатывает предыдущие запросы.",
    };
  }

  user.count++;
  return { allowed: true };
}

const messageQueue = [];
let processing = false;
const MAX_QUEUE_SIZE = 100; 
const PROCESS_INTERVAL = 150; 

/**
 * Обработка очереди
 */
async function processQueue() {
  if (processing || messageQueue.length === 0) return;

  processing = true;
  const { bot, msg, handler } = messageQueue.shift();

  try {
    await handler(bot, msg);
  } catch (err) {
    console.error("Ошибка при обработке сообщения:", err);
  }

  processing = false;
}


setInterval(processQueue, PROCESS_INTERVAL);


function safeHandle(bot, msg, handler) {
  if (messageQueue.length > MAX_QUEUE_SIZE) {
    
    if (Math.random() < 0.05) {
      bot.sendMessage(
        msg.chat.id,
        "⚙️ Бот сейчас обрабатывает много запросов, попробуйте чуть позже."
      );
    }
    return;
  }

  
  messageQueue.push({ bot, msg, handler });
}


function initBot() {
  if (!bot) {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });

    
    setInterval(() => saveSessions(userSessions), 30_000);

    
    setInterval(() => {
      const now = Date.now();
      Object.keys(userRequests).forEach((key) => {
        if (now - userRequests[key].windowStart > RATE_LIMIT.WINDOW_MS * 2) {
          delete userRequests[key];
        }
      });
    }, 300_000);

   
  }
  return bot;
}

module.exports = {
  initBot,
  userSessions,
  getBot: () => bot,
  checkRateLimit,
  safeHandle, 
};
