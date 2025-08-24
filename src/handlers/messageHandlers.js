const { BOT_STATES, keyboard, AUTHOR_INFO } = require("../config");
const { userSessions } = require("../bot");
const { refreshToken } = require("../auth");
const { checkDeadlines } = require("./taskHandlers");
const { isValidTime, scheduleReminder } = require("../reminders");

async function sendInstructions(bot, chatId) {
  const instructions = `
📋 <b>Инструкция по работе с ботом:</b>

🔑 <b>/start</b> - Авторизация на платформе (ввод email и пароля).
📅 <b>/tasks</b> - Проверить текущие сроки заданий.
🔔 <b>/reminder</b> - Настроить ежедневные напоминания о дедлайнах.
🚫 <b>/stopreminder</b> - Отключить ежедневные напоминания.
👨‍💻 <b>/dev</b> - Информация о создателе бота.
🔒 <b>/logout</b> - Выйти из системы и удалить данные.
ℹ️ <b>/help</b> - Показать эту инструкцию снова.

Используйте кнопки ниже или начните с команды /tasks!
  `;
  await bot.sendMessage(chatId, instructions, {
    parse_mode: "HTML",
    ...keyboard,
  });
}

async function sendAuthorInfo(bot, chatId) {
  const authorMessage = `
🎯 <b>IThub Magas Bot</b> - Помощник для студентов

<b>📱 Создатель:</b>
├─ <b>Имя:</b> ${AUTHOR_INFO.name}
├─ <b>Telegram:</b> ${AUTHOR_INFO.contact}
├─ <b>Email:</b> ${AUTHOR_INFO.email}
└─ <b>GitHub:</b> <a href="${AUTHOR_INFO.github}">${AUTHOR_INFO.github}</a>

<b>🔧 Техническая информация:</b>
├─ <b>Платформа:</b> IThub Colleges
└─ <b>Назначение:</b> Уведомления о дедлайнах заданий

💡 <i>По вопросам сотрудничества и предложениям пишите автору!</i>
  `;

  await bot.sendMessage(chatId, authorMessage, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...keyboard,
  });
}

async function sendWelcomeMessage(bot, chatId) {
  const welcomeMessage = `
🎓 <b>Добро пожаловать в IThub Magas Bot!</b>

Этот бот поможет вам:
✅ Следить за дедлайнами заданий
✅ Получать своевременные уведомления
✅ Не пропускать важные сроки сдачи

Для начала работы введите ваш email от образовательной платформы IThub:
  `;

  await bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "HTML"
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
    await sendWelcomeMessage(bot, chatId);
  });

  
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await sendInstructions(bot, chatId);
  });

  
  bot.onText(/\/dev/, async (msg) => {
    const chatId = msg.chat.id;
    await sendAuthorInfo(bot, chatId);
  });

  
  bot.onText(/\/reminder/, async (msg) => {
    const chatId = msg.chat.id;

    if (!userSessions[chatId]?.token) {
      await bot.sendMessage(
        chatId,
        "🔐 Вы не авторизованы. Введите /start для начала работы.",
        keyboard
      );
      return;
    }

    userSessions[chatId].state = BOT_STATES.WAITING_REMINDER_TIME;
    await bot.sendMessage(
      chatId,
      "⏰ Введите время для ежедневных напоминаний в формате HH:MM (например, 14:30):\n\n📅 Бот будет проверять дедлайны каждый день в указанное время и присылать уведомления.",
      keyboard
    );
  });

  
  bot.onText(/\/stopreminder/, async (msg) => {
    const chatId = msg.chat.id;

    if (!userSessions[chatId]?.token) {
      await bot.sendMessage(
        chatId,
        "🔐 Вы не авторизованы. Введите /start для начала работы.",
        keyboard
      );
      return;
    }

    if (userSessions[chatId]?.reminder?.cronTask) {
      userSessions[chatId].reminder.cronTask.destroy();
      delete userSessions[chatId].reminder;
      await bot.sendMessage(
        chatId,
        "🔔 Ежедневные напоминания отключены. Вы больше не будете получать автоматические уведомления.",
        keyboard
      );
    } else {
      await bot.sendMessage(
        chatId,
        "ℹ️ Напоминания не были настроены. Используйте /reminder чтобы настроить их.",
        keyboard
      );
    }
  });

  
  bot.onText(/\/tasks/, async (msg) => {
    const chatId = msg.chat.id;

    if (!userSessions[chatId]?.token) {
      await bot.sendMessage(
        chatId,
        "🔐 Вы не авторизованы. Введите /start для начала работы.",
        keyboard
      );
      return;
    }

    await bot.sendMessage(chatId, "⏳ Загружаю информацию о заданиях...", keyboard);
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
        "🔒 Вы вышли из системы. Все ваши данные и настройки напоминаний удалены.\n\nДля входа снова используйте /start."
      );
    } else {
      await bot.sendMessage(chatId, "ℹ️ Вы не авторизованы. Используйте /start для входа.");
    }
  });

  
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    
    if (text.startsWith("/") || !text.trim()) return;

    const session = userSessions[chatId] || { state: BOT_STATES.IDLE };

    try {
      
      if (session.state === BOT_STATES.WAITING_EMAIL) {
        const email = text.trim();
        
        if (!email.includes("@") || !email.includes(".") || email.length < 5) {
          await bot.sendMessage(
            chatId,
            "❌ Неверный формат email. Пожалуйста, введите корректный email от образовательной платформы IThub:"
          );
          return;
        }

        userSessions[chatId] = {
          ...session,
          state: BOT_STATES.WAITING_PASSWORD,
          credentials: { email: email.toLowerCase() }, 
        };
        
        await bot.sendMessage(
          chatId,
          "🔑 Теперь введите ваш пароль:\n\n⚠️ <b>Безопасность:</b> Ваш пароль не сохраняется и используется только для получения токена доступа.",
          { parse_mode: "HTML" }
        );
      
      
      } else if (session.state === BOT_STATES.WAITING_PASSWORD) {
        const password = text.trim();
        
        if (password.length < 4) {
          await bot.sendMessage(
            chatId,
            "❌ Пароль слишком короткий. Пожалуйста, введите корректный пароль:"
          );
          return;
        }

        await bot.sendMessage(chatId, "⏳ Проверяем ваши данные...");

        try {
          const email = session.credentials.email;
          await refreshToken(chatId, email, password);

          await bot.sendMessage(
            chatId,
            "✅ <b>Вы успешно авторизованы!</b>\n\nТеперь вы можете использовать все функции бота.",
            { parse_mode: "HTML", ...keyboard }
          );
          await sendInstructions(bot, chatId);
        } catch (error) {
          console.error("Ошибка авторизации:", error);
          delete userSessions[chatId];
          
          let errorMessage = "❌ Ошибка авторизации. ";
          if (error.response?.data?.errors?.[0]?.message) {
            errorMessage += error.response.data.errors[0].message;
          } else {
            errorMessage += "Неверный email или пароль.";
          }
          
          errorMessage += "\n\nПожалуйста, начните заново с команды /start.";
          
          await bot.sendMessage(chatId, errorMessage);
        }
      
      
      } else if (session.state === BOT_STATES.WAITING_REMINDER_TIME) {
        const time = text.trim();
        
        if (!isValidTime(time)) {
          await bot.sendMessage(
            chatId,
            "❌ Неверный формат времени. Пожалуйста, введите время в формате HH:MM (например, 09:30 или 14:45):",
            keyboard
          );
          return;
        }

        scheduleReminder(bot, chatId, time);
        userSessions[chatId].state = BOT_STATES.IDLE;
        
        await bot.sendMessage(
          chatId,
          `✅ <b>Ежедневные напоминания настроены на ${time}</b>\n\n📅 Бот будет проверять дедлайны каждый день в это время и присылать уведомления.\n\nИспользуйте /stopreminder для отключения напоминаний.`,
          { parse_mode: "HTML", ...keyboard }
        );
      
      
      } else {
        await bot.sendMessage(
          chatId,
          "🤔 Я не понимаю эту команду. Используйте /help для просмотра доступных команд.",
          keyboard
        );
      }
    } catch (error) {
      console.error("Ошибка обработки сообщения:", error);
      await bot.sendMessage(
        chatId,
        "⚠️ Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже или используйте /help для справки.",
        keyboard
      );
    }
  });

  
  bot.on("polling_error", (error) => {
    console.error("Polling error:", error);
  });

  bot.on("webhook_error", (error) => {
    console.error("Webhook error:", error);
  });

  console.log("✅ Message handlers setup completed");
}

module.exports = { 
  setupMessageHandlers, 
  sendInstructions, 
  sendAuthorInfo,
  sendWelcomeMessage 
};