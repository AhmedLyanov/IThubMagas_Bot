const { BOT_STATES, keyboard, AUTHOR_INFO, CO_AUTHOR_INFO } = require("../config");
const { userSessions, checkRateLimit, safeHandle } = require("../bot"); 
const { refreshToken } = require("../auth");
const { checkDeadlines } = require("./taskHandlers");
const { isValidTime, scheduleReminder } = require("../reminders");

async function checkAndHandleRateLimit(bot, chatId, command = '') {
  const limitCheck = checkRateLimit(chatId, command);

  if (!limitCheck.allowed) {
    await bot.sendMessage(chatId, limitCheck.reason, keyboard);
    return false;
  }

  if (limitCheck.warning) {
    await bot.sendMessage(chatId, limitCheck.warning, keyboard);
  }

  return true;
}

async function sendInstructions(bot, chatId) {
  const instructions = `
Инструкция по работе с ботом:

/start - Авторизация на платформе (ввод email и пароля).
/tasks - Проверить текущие сроки заданий.
/reminder - Настроить ежедневные напоминания о дедлайнах.
/stopreminder - Отключить ежедневные напоминания.
/dev - Информация о создателе бота.
/logout - Выйти из системы и удалить данные.
/help - Показать эту инструкцию снова.
/schedule - расписание на неделю
/notifications - ваши уведомления

Используйте кнопки ниже или начните с команды /tasks!
  `;
  await bot.sendMessage(chatId, instructions, {
    parse_mode: "HTML",
    ...keyboard,
  });
}

async function sendAuthorInfo(bot, chatId) {
  const authorMessage = `
IThub Helper - Помощник для студентов

Создатель:
Имя: ${AUTHOR_INFO.name}
Telegram: ${AUTHOR_INFO.contact}
Email: ${AUTHOR_INFO.email}
GitHub: <a href="${AUTHOR_INFO.github}">${AUTHOR_INFO.github}</a>

Соавтор:
Имя: ${CO_AUTHOR_INFO.name}
Telegram: ${CO_AUTHOR_INFO.contact}
Email: ${CO_AUTHOR_INFO.email}
GitHub: <a href="${CO_AUTHOR_INFO.github}">${CO_AUTHOR_INFO.github}</a>

Платформа: IThub Colleges
Назначение: уведомления о дедлайнах заданий
  `;

  await bot.sendMessage(chatId, authorMessage, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...keyboard,
  });
}

async function sendWelcomeMessage(bot, chatId) {
  const welcomeMessage = `
Добро пожаловать в IThub Helper!

Этот бот поможет вам:
- Следить за дедлайнами заданий
- Получать своевременные уведомления
- Не пропускать важные сроки сдачи

Для начала работы введите ваш email от образовательной платформы IThub:
  `;

  await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "HTML" });
}

function setupMessageHandlers(bot) {

  bot.onText(/\/start/, (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;

      if (!(await checkAndHandleRateLimit(bot, chatId, '/start'))) return;

      if (userSessions[chatId]?.token) {
        await sendInstructions(bot, chatId);
        return;
      }

      userSessions[chatId] = { state: BOT_STATES.WAITING_EMAIL };
      await sendWelcomeMessage(bot, chatId);
    })
  );

 
  bot.onText(/\/help/, (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;
      if (!(await checkAndHandleRateLimit(bot, chatId, '/help'))) return;
      await sendInstructions(bot, chatId);
    })
  );

  bot.onText(/\/dev/, (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;
      if (!(await checkAndHandleRateLimit(bot, chatId, '/dev'))) return;
      await sendAuthorInfo(bot, chatId);
    })
  );


  bot.onText(/\/schedule/, (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;

      if (!(await checkAndHandleRateLimit(bot, chatId, '/schedule'))) return;

      if (!userSessions[chatId]?.token) {
        await bot.sendMessage(
          chatId,
          "Вы не авторизованы. Введите /start для начала работы.",
          keyboard
        );
        return;
      }

      try {
        await bot.sendMessage(chatId, "Загружаю расписание на неделю...", keyboard);
        const { getSchedule, formatSchedule } = require("../schedule");
        const { renderScheduleTable } = require("../utils/tableRenderer");

        const classes = await getSchedule(
          userSessions[chatId].token,
          userSessions[chatId].studentId
        );
        const formatted = formatSchedule(classes);

        if (Object.keys(formatted).length === 0) {
          await bot.sendMessage(chatId, "На эту неделю расписание пустое.", keyboard);
          return;
        }

        const imageBuffer = await renderScheduleTable(formatted);
        await bot.sendPhoto(chatId, imageBuffer, {
          caption: "Расписание на неделю:",
          ...keyboard,
        });
      } catch (error) {
        console.error("Ошибка расписания:", error);
        await bot.sendMessage(
          chatId,
          `Ошибка загрузки расписания: ${error.message}`,
          keyboard
        );
      }
    })
  );

  
  bot.onText(/\/reminder/, (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;
      if (!(await checkAndHandleRateLimit(bot, chatId, '/reminder'))) return;

      if (!userSessions[chatId]?.token) {
        await bot.sendMessage(chatId, "Вы не авторизованы. Введите /start для начала работы.", keyboard);
        return;
      }

      userSessions[chatId].state = BOT_STATES.WAITING_REMINDER_TIME;
      await bot.sendMessage(
        chatId,
        "Введите время для ежедневных напоминаний (например, 14:30).",
        keyboard
      );
    })
  );


  bot.onText(/\/stopreminder/, (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;
      if (!(await checkAndHandleRateLimit(bot, chatId, '/stopreminder'))) return;

      if (!userSessions[chatId]?.token) {
        await bot.sendMessage(chatId, "Вы не авторизованы. Введите /start для начала работы.", keyboard);
        return;
      }

      if (userSessions[chatId]?.reminder?.cronTask) {
        userSessions[chatId].reminder.cronTask.destroy();
        delete userSessions[chatId].reminder;
        await bot.sendMessage(chatId, "Ежедневные напоминания отключены.", keyboard);
      } else {
        await bot.sendMessage(chatId, "Напоминания не были настроены.", keyboard);
      }
    })
  );


  bot.onText(/\/tasks/, (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;
      if (!(await checkAndHandleRateLimit(bot, chatId, '/tasks'))) return;

      if (!userSessions[chatId]?.token) {
        await bot.sendMessage(chatId, "Вы не авторизованы. Введите /start для начала работы.", keyboard);
        return;
      }

      await bot.sendMessage(chatId, "Загружаю информацию о заданиях...", keyboard);
      await checkDeadlines(bot, chatId);
    })
  );


  bot.onText(/\/notifications/, (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;
      if (!(await checkAndHandleRateLimit(bot, chatId, '/notifications'))) return;

      if (!userSessions[chatId]?.token) {
        await bot.sendMessage(chatId, "Вы не авторизованы. Введите /start для начала работы.", keyboard);
        return;
      }

      try {
        await bot.sendMessage(chatId, "Загружаю уведомления...", keyboard);
        const { getNotifications, filterAssignmentNotifications, formatNotificationsList } = require("../notifications");

        const notificationsData = await getNotifications(userSessions[chatId].token);
        const assignmentNotifications = filterAssignmentNotifications(notificationsData);

        if (assignmentNotifications.length === 0) {
          await bot.sendMessage(chatId, "У вас нет уведомлений о заданиях.", { parse_mode: "HTML", ...keyboard });
          return;
        }

        const message = formatNotificationsList(assignmentNotifications);
        await bot.sendMessage(chatId, message, { parse_mode: "HTML", ...keyboard });
      } catch (error) {
        console.error("Ошибка уведомлений:", error);
        await bot.sendMessage(chatId, `Ошибка: ${error.message}`, keyboard);
      }
    })
  );

  
  bot.onText(/\/logout/, (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;
      if (!(await checkAndHandleRateLimit(bot, chatId, '/logout'))) return;

      if (userSessions[chatId]) {
        if (userSessions[chatId].reminder?.cronTask) {
          userSessions[chatId].reminder.cronTask.destroy();
        }
        delete userSessions[chatId];
        await bot.sendMessage(chatId, "Вы вышли из системы. Все данные удалены.");
      } else {
        await bot.sendMessage(chatId, "Вы не авторизованы. Используйте /start.");
      }
    })
  );


  bot.on("message", (msg) =>
    safeHandle(bot, msg, async (bot, msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (!text || text.startsWith("/") || !text.trim()) return;
      if (!(await checkAndHandleRateLimit(bot, chatId, 'message'))) return;

      const session = userSessions[chatId] || { state: BOT_STATES.IDLE };

      try {
        if (session.state === BOT_STATES.WAITING_EMAIL) {
          const email = text.trim();
          if (!email.includes("@") || !email.includes(".")) {
            await bot.sendMessage(chatId, "Неверный формат email. Повторите ввод.");
            return;
          }

          userSessions[chatId] = {
            ...session,
            state: BOT_STATES.WAITING_PASSWORD,
            credentials: { email: email.toLowerCase() },
          };

          await bot.sendMessage(chatId, "Теперь введите ваш пароль:", { parse_mode: "HTML" });
        } else if (session.state === BOT_STATES.WAITING_PASSWORD) {
          const password = text.trim();

          if (password.length < 4) {
            await bot.sendMessage(chatId, "Пароль слишком короткий. Повторите ввод.");
            return;
          }

          await bot.sendMessage(chatId, "Проверяем данные...");
          try {
            const email = session.credentials.email;
            await refreshToken(chatId, email, password);
            await bot.sendMessage(chatId, "✅ Авторизация успешна!", { parse_mode: "HTML", ...keyboard });
            await sendInstructions(bot, chatId);
          } catch (error) {
            console.error("Ошибка авторизации:", error);
            delete userSessions[chatId];
            await bot.sendMessage(chatId, "Ошибка авторизации. Попробуйте снова с /start.");
          }
        } else if (session.state === BOT_STATES.WAITING_REMINDER_TIME) {
          const time = text.trim();
          if (!isValidTime(time)) {
            await bot.sendMessage(chatId, "Неверный формат времени. Введите HH:MM.");
            return;
          }

          scheduleReminder(bot, chatId, time);
          userSessions[chatId].state = BOT_STATES.IDLE;
          await bot.sendMessage(chatId, `Напоминания настроены на ${time}.`, { parse_mode: "HTML", ...keyboard });
        } else {
          await bot.sendMessage(chatId, "Я не понимаю эту команду. Используйте /help.", keyboard);
        }
      } catch (error) {
        console.error("Ошибка обработки:", error);
        await bot.sendMessage(chatId, "Произошла ошибка. Попробуйте позже.", keyboard);
      }
    })
  );

  bot.on("polling_error", (error) => console.error("Polling error:", error));
  bot.on("webhook_error", (error) => console.error("Webhook error:", error));

  console.log("Message handlers setup completed with protection");
}

module.exports = {
  setupMessageHandlers,
  sendInstructions,
  sendAuthorInfo,
  sendWelcomeMessage,
};
