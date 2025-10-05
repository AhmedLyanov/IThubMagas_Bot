require("dotenv").config();

const API_URL = process.env.WEB_API_URL;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const BOT_STATES = {
  IDLE: 0,
  WAITING_EMAIL: 1,
  WAITING_PASSWORD: 2,
  WAITING_REMINDER_TIME: 3,
};

const keyboard = {
  reply_markup: {
    resize_keyboard: true,
    keyboard: [
      [{ text: "/tasks" }, {text: '/schedule'}, {text: '/notifications'}, { text: "/reminder" }],
      [{ text: "/stopreminder" }, { text: "/logout" }, { text: "/dev"}],
    ],
  },
};

const AUTHOR_INFO = {
  name: "Ахмед",
  contact: "@DevAhmed1",
  email: "amoshal1997@gmail.com",
  github: "https://github.com/AhmedLyanov",
};


module.exports = { API_URL, BOT_TOKEN, BOT_STATES, keyboard, AUTHOR_INFO };