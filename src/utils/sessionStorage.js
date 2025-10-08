const fs = require("fs");
const path = require("path");

const SESSIONS_FILE = path.join(__dirname, "../../data/sessions.json");

// Создание папки data при необходимости
fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Ошибка при загрузке сессий:", err);
  }
  return {};
}

function saveSessions(sessions) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (err) {
    console.error("Ошибка при сохранении сессий:", err);
  }
}

module.exports = { loadSessions, saveSessions };
