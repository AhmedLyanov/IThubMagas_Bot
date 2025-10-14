const TelegramBot = require("node-telegram-bot-api");
const { BOT_TOKEN, RATE_LIMIT } = require("./config");
const { loadSessions, saveSessions } = require("./utils/sessionStorage");

const userSessions = loadSessions();


const userRequests = {};

let bot;


function checkRateLimit(chatId, command = '') {
  const now = Date.now();
  const userKey = `user_${chatId}`;
  
  
  if (!userRequests[userKey] || now - userRequests[userKey].windowStart > RATE_LIMIT.WINDOW_MS) {
    userRequests[userKey] = {
      count: 0,
      windowStart: now,
      blockedUntil: null,
      commandCounts: {}
    };
  }

  const user = userRequests[userKey];

  
  if (user.blockedUntil && now < user.blockedUntil) {
    const timeLeft = Math.ceil((user.blockedUntil - now) / 1000);
    return { 
      allowed: false, 
      reason: `🚫 Слишком много запросов! Подождите ${timeLeft} секунд.` 
    };
  }

  
  if (user.count >= RATE_LIMIT.MAX_REQUESTS) {
    user.blockedUntil = now + RATE_LIMIT.BLOCK_TIME_MS;
    return { 
      allowed: false, 
      reason: `🚫 Превышен лимит запросов! Блокировка на ${RATE_LIMIT.BLOCK_TIME_MS / 60000} минут.` 
    };
  }

  
  if (command && RATE_LIMIT.HEAVY_COMMANDS[command]) {
    const commandLimit = RATE_LIMIT.HEAVY_COMMANDS[command];
    user.commandCounts[command] = (user.commandCounts[command] || 0) + 1;
    
    if (user.commandCounts[command] > commandLimit) {
      user.blockedUntil = now + RATE_LIMIT.BLOCK_TIME_MS;
      return { 
        allowed: false, 
        reason: `🚫 Слишком много запросов для команды ${command}! Подождите ${RATE_LIMIT.BLOCK_TIME_MS / 60000} минут.` 
      };
    }
  }

  
  user.count++;
  
  
  if (user.count === Math.floor(RATE_LIMIT.MAX_REQUESTS * 0.8)) {
    return { 
      allowed: true, 
      warning: `⚠️ Вы использовали ${user.count} из ${RATE_LIMIT.MAX_REQUESTS} запросов в минуту.` 
    };
  }

  return { allowed: true };
}

function initBot() {
  if (!bot) {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });

    setInterval(() => saveSessions(userSessions), 30_000);
    
    
    setInterval(() => {
      const now = Date.now();
      Object.keys(userRequests).forEach(key => {
        if (now - userRequests[key].windowStart > RATE_LIMIT.WINDOW_MS * 2) {
          delete userRequests[key];
        }
      });
    }, 300000);
  }
  return bot;
}

module.exports = { 
  initBot, 
  userSessions, 
  getBot: () => bot,
  checkRateLimit 
};