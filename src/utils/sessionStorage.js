const fs = require("fs");
const path = require("path");

const SESSIONS_FILE = path.resolve(process.cwd(), "data/sessions.json");

fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, "utf8");
      return JSON.parse(data || "{}");
    }
  } catch (err) {
    console.error(err);
  }
  return {};
}

function saveSessions(newData) {
  try {
    const existing = loadSessions();
    const merged = { ...existing, ...newData };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(merged, null, 2));
  } catch (err) {
    console.error(err);
  }
}

module.exports = { loadSessions, saveSessions };
