const { BOT_STATES, keyboard } = require("../config");
const { userSessions } = require("../bot");
const { refreshToken } = require("../auth");
const { checkDeadlines } = require("./taskHandlers");
const { isValidTime, scheduleReminder } = require("../reminders");

async function sendInstructions(bot, chatId) {
  const instructions = `
📋 <b>Инструкция по работе с ботом:</b>

🔑 <b>/start</b> - Авторизация на платформе (ввод email и пароля).
📅 <b>/tasks</b> - Проверить текущие сроки.
🔔 <b>/reminder</b> - Настроить ежедневные напоминания о дедлайнах (выберите время).
🚫 <b>/stopreminder</b> - Отключить ежедневные напоминания.
🔒 <b>/logout</b> - Выйти из системы и удалить данные.

Используйте кнопки ниже или начните с команды /tasks!
  `;
  await bot.sendMessage(chatId, instructions, {
    parse_mode: "HTML",
    ...keyboard,
  });
}

function setupMessageHandlers(bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    if (userSessions[chatId]?.token) {
      await sendInstructions(bot, chatId);
      return;
    }

    userSessions[chatId] = { state: BOT_STATES.WAITING_EMAIL };
    await bot.sendMessage(
      chatId,
      "👋 Добро пожаловать! Для начала работы введите ваш email от образовательной платформы IThub:"
    );
  });

  bot.onText(/\/reminder/, async (msg) => {
    const chatId = msg.chat.id;

    if (!userSessions[chatId]?.token) {
      await bot.sendMessage(
        chatId,
        "🔐 Вы не авторизованы. Введите /start для начала работы."
      );
      return;
    }

    userSessions[chatId].state = BOT_STATES.WAITING_REMINDER_TIME;
    await bot.sendMessage(
      chatId,
      "⏰ Введите время для ежедневных напоминаний в формате HH:MM (например, 14:30):",
      keyboard
    );
  });

  bot.onText(/\/stopreminder/, async (msg) => {
    const chatId = msg.chat.id;

    if (!userSessions[chatId]?.token) {
      await bot.sendMessage(
        chatId,
        "🔐 Вы не авторизованы. Введите /start для начала работы."
      );
      return;
    }

    if (userSessions[chatId]?.reminder?.cronTask) {
      userSessions[chatId].reminder.cronTask.destroy();
      delete userSessions[chatId].reminder;
      await bot.sendMessage(
        chatId,
        "🔔 Ежедневные напоминания отключены.",
        keyboard
      );
    } else {
      await bot.sendMessage(
        chatId,
        "ℹ️ Напоминания не были настроены.",
        keyboard
      );
    }
  });

  bot.onText(/\/tasks/, async (msg) => {
    const chatId = msg.chat.id;

    if (!userSessions[chatId]?.token) {
      await bot.sendMessage(
        chatId,
        "🔐 Вы не авторизованы. Введите /start для начала работы."
      );
      return;
    }

    await checkDeadlines(bot, chatId);
  });

  bot.onText(/\/logout/, async (msg) => {
    const chatId = msg.chat.id;

    if (userSessions[chatId]) {
      if (userSessions[chatId].reminder?.cronTask) {
        userSessions[chatId].reminder.cronTask.destroy();
      }
      delete userSessions[chatId];
      await bot.sendMessage(
        chatId,
        "🔒 Вы вышли из системы. Ваши данные и напоминания удалены. Для входа снова используйте /start."
      );
    } else {
      await bot.sendMessage(chatId, "ℹ️ Вы не авторизованы.");
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text.startsWith("/")) return;

    const session = userSessions[chatId] || { state: BOT_STATES.IDLE };

    try {
      if (session.state === BOT_STATES.WAITING_EMAIL) {
        if (!text.includes("@") || !text.includes(".")) {
          await bot.sendMessage(
            chatId,
            "❌ Неверный формат email. Пожалуйста, введите корректный email:"
          );
          return;
        }

        userSessions[chatId] = {
          ...session,
          state: BOT_STATES.WAITING_PASSWORD,
          credentials: { email: text.trim() },
        };
        await bot.sendMessage(chatId, "🔑 Теперь введите ваш пароль:");
      } else if (session.state === BOT_STATES.WAITING_PASSWORD) {
        if (text.length < 4) {
          await bot.sendMessage(
            chatId,
            "❌ Пароль слишком короткий. Пожалуйста, введите корректный пароль:"
          );
          return;
        }

        await bot.sendMessage(chatId, "⏳ Проверяем ваши данные...");

        try {
          const email = session.credentials.email;
          await refreshToken(chatId, email, text.trim());

          await bot.sendMessage(chatId, "✅ Вы успешно авторизованы!");
          await sendInstructions(bot, chatId);
        } catch (error) {
          delete userSessions[chatId];
          await bot.sendMessage(
            chatId,
            "❌ Ошибка авторизации. Неверный email или пароль. Пожалуйста, начните заново с команды /start."
          );
        }
      } else if (session.state === BOT_STATES.WAITING_REMINDER_TIME) {
        if (!isValidTime(text)) {
          await bot.sendMessage(
            chatId,
            "❌ Неверный формат времени. Пожалуйста, введите время в формате HH:MM (например, 14:30):",
            keyboard
          );
          return;
        }

        scheduleReminder(bot, chatId, text); 
        userSessions[chatId].state = BOT_STATES.IDLE;
        await bot.sendMessage(
          chatId,
          `🔔 Ежедневные напоминания настроены на ${text}. Используйте /stopreminder для отключения.`,
          keyboard
        );
      }
    } catch (error) {
      console.error("Ошибка обработки сообщения:", error);
      await bot.sendMessage(
        chatId,
        "⚠️ Произошла ошибка. Пожалуйста, попробуйте позже."
      );
    }
  });
}

module.exports = { setupMessageHandlers, sendInstructions };