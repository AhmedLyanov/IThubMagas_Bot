const cron = require("node-cron");
const { userSessions } = require("./bot");
const { checkDeadlines } = require("./handlers/taskHandlers");

function scheduleReminder(bot, chatId, time) {
  const [hours, minutes] = time.split(":").map(Number);

  if (userSessions[chatId]?.reminder?.cronTask) {
    userSessions[chatId].reminder.cronTask.destroy();
  }

  const cronExpression = `${minutes} ${hours} * * *`;
  const cronTask = cron.schedule(
    cronExpression,
    () => {
      checkDeadlines(bot, chatId).catch((err) => {
        console.error("Ошибка в напоминании:", err);
      });
    },
    { timezone: "Europe/Moscow" }
  );

  userSessions[chatId].reminder = {
    time,
    cronTask,
  };
}

function isValidTime(timeStr) {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(timeStr);
}

module.exports = { isValidTime, scheduleReminder };
