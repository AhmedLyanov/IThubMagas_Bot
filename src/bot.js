const TelegramBot = require("node-telegram-bot-api");
const { BOT_TOKEN } = require("./config");

const userSessions = {};
let bot;

function initBot() {
  if (!bot) {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
  }
  return bot;
}

module.exports = { initBot, userSessions, getBot: () => bot };