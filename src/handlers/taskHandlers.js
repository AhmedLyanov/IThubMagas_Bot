const { keyboard } = require("../config");
const { userSessions } = require("../bot");
const { refreshToken } = require("../auth");
const { getTasksWithDeadlines, getDayText, getHourText } = require("../tasks");

async function checkDeadlines(bot, chatId) {
  try {
    let session = userSessions[chatId];

    if (!session) {
      await bot.sendMessage(
        chatId,
        "Вы не авторизованы. Введите /start для начала работы."
      );
      return;
    }

    if (new Date() - new Date(session.lastRefreshed) > 12 * 60 * 60 * 1000) {
      try {
        await refreshToken(
          chatId,
          session.credentials.email,
          session.credentials.password
        );
        session = userSessions[chatId];
      } catch (error) {
        console.error("Ошибка обновления токена:", error);
        if (userSessions[chatId]?.reminder?.cronTask) {
          userSessions[chatId].reminder.cronTask.destroy();
        }
        delete userSessions[chatId];
        await bot.sendMessage(
          chatId,
          "Ваша сессия истекла. Пожалуйста, авторизуйтесь снова с помощью /start."
        );
        return;
      }
    }

    const tasks = await getTasksWithDeadlines(session.token, session.studentId);
    const now = new Date();

    const sortedTasks = tasks
      .filter((task) => task.deadline > now)
      .sort((a, b) => a.deadline - b.deadline);

    if (sortedTasks.length > 0) {
      let message = "<b>Ваши приближающиеся сроки:</b>\n\n";

      sortedTasks.forEach((task) => {
        const hoursLeft = Math.ceil((task.deadline - now) / (1000 * 60 * 60));
        let timeLeftText;

        if (hoursLeft < 24) {
          timeLeftText = `Осталось: ${hoursLeft} ${getHourText(hoursLeft)}`;
        } else {
          const daysLeft = Math.ceil(hoursLeft / 24);
          timeLeftText = `Осталось: ${daysLeft} ${getDayText(daysLeft)}`;
        }

        message += `<b>${task.name}</b> \n`;
        message += `Тема: ${task.topic}\n`;
        message += `${timeLeftText}\n`;
        message += `Срок: ${task.deadline.toLocaleString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}\n`;
        if (task.link) {
          message += `<a href="${task.link}">Перейти к списку задач</a>\n-------------------------\n\n\n`;
        } else {
          message += `\n`;
        }
      });

      await bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } else {
      await bot.sendMessage(
        chatId,
        "На данный момент сроков нет. Проверьте сайт платформы.",
        keyboard
      );
    }
  } catch (error) {
    console.error("Ошибка при проверке дедлайнов:", error);
    try {
      const session = userSessions[chatId];
      if (session?.credentials?.email && session?.credentials?.password) {
        await refreshToken(
          chatId,
          session.credentials.email,
          session.credentials.password
        );
        await checkDeadlines(bot, chatId);
      } else {
        throw new Error("Нет учетных данных для обновления токена");
      }
    } catch (refreshError) {
      console.error("Ошибка при повторном обновлении токена:", refreshError);
      if (userSessions[chatId]?.reminder?.cronTask) {
        userSessions[chatId].reminder.cronTask.destroy();
      }
      delete userSessions[chatId];
      await bot.sendMessage(
        chatId,
        "Ваша сессия истекла из-за ошибки авторизации. Пожалуйста, авторизуйтесь снова с помощью /start."
      );
    }
  }
}

module.exports = { checkDeadlines };