const TelegramBot = require("node-telegram-bot-api");
const { BOT_TOKEN } = require("./config");
const { loadSessions, saveSessions } = require("./utils/sessionStorage");

const userSessions = loadSessions();
let bot;

function initBot() {
  if (!bot) {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });

    setInterval(() => saveSessions(userSessions), 30_000);
  }
  return bot;
}

module.exports = { initBot, userSessions, getBot: () => bot };
