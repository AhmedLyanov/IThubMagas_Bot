const axios = require("axios");
const cron = require("node-cron");
const { API_URL } = require("./config");
const { userSessions } = require("./bot");

async function refreshToken(chatId, email, password) {
  try {
    const query = `
      query SignIn($input: SignInInput!) {
        signIn(input: $input) {
          accessToken
          user { id }
        }
      }
    `;

    const variables = {
      input: {
        email: email,
        password: password,
      },
    };

    const response = await axios.post(
      API_URL,
      {
        query,
        variables,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL Errors:", response.data.errors);
      throw new Error(response.data.errors[0].message);
    }

    const { accessToken, user } = response.data.data.signIn;
    userSessions[chatId] = {
      ...userSessions[chatId],
      token: accessToken,
      studentId: user.id,
      lastRefreshed: new Date(),
      credentials: { email, password },
    };

    return accessToken;
  } catch (error) {
    console.error("Ошибка авторизации:", {
      message: error.message,
      response: error.response?.data,
      config: error.config,
    });
    throw error;
  }
}

function scheduleTokenRefresh() {
  cron.schedule("0 */6 * * *", async () => {
    for (const chatId in userSessions) {
      const session = userSessions[chatId];
      if (session.credentials?.email && session.credentials?.password) {
        try {
          await refreshToken(
            chatId,
            session.credentials.email,
            session.credentials.password
          );
          console.log(`Токен обновлен для chatId: ${chatId}`);
        } catch (error) {
          console.error(
            `Ошибка обновления токена для chatId ${chatId}:`,
            error
          );
        }
      }
    }
  });
}

module.exports = { refreshToken, scheduleTokenRefresh };