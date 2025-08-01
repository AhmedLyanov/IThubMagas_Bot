require("dotenv").config();
const { initBot } = require("./src/bot");
const { setupMessageHandlers } = require("./src/handlers/messageHandlers");
const { scheduleTokenRefresh } = require("./src/auth");

const bot = initBot();
setupMessageHandlers(bot);
scheduleTokenRefresh();

bot.on("polling_error", (error) => {
  console.error("Polling error:", error);
});