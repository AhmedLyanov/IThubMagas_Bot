const axios = require("axios");
const { API_URL } = require("./config");

async function getNotifications(token, page = 1, pageSize = 10) {
  const query = `
    query GetNotifications($input: NotificationsInput!) {
      notifications(input: $input) {
        items {
          ...NotificationFragment
          __typename
        }
        hasMore
        page
        perPage
        total
        totalPages
        __typename
      }
    }

    fragment NotificationFragment on Notification {
      isRead
      id
      title
      body
      createdAt
      __typename
    }
  `;

  const variables = {
    input: {
      page: page,
      pageSize: pageSize,
      filters: {}
    }
  };

  try {
    const response = await axios.post(API_URL, { query, variables }, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    return response.data.data.notifications;
  } catch (error) {
    console.error("Ошибка получения уведомлений:", error.message);
    throw error;
  }
}

function filterAssignmentNotifications(notifications) {
  const assignmentKeywords = [
    "сдано",
    "не сдано",
    "баллы",
    "задание",
    "оценк",
    "статус",
    "проверен",
    "выставлен"
  ];

  return notifications.items.filter(notification => {
    const title = notification.title.toLowerCase();
    const body = notification.body.toLowerCase();
    
    return assignmentKeywords.some(keyword => 
      title.includes(keyword) || body.includes(keyword)
    );
  });
}

function formatNotificationMessage(notification) {
  const { title, body, createdAt, isRead } = notification;
  
  
  const cleanBody = body
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const date = new Date(createdAt).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const status = isRead ? "Прочитано" : "Новое";

  return `
${status}
<b>${title}</b>
${date}

${cleanBody}
  `.trim();
}

function formatNotificationsList(notifications) {
  if (notifications.length === 0) {
    return "Нет уведомлений о заданиях.";
  }

  let message = `📬 Уведомления о заданиях (${notifications.length}):\n\n`;

  notifications.forEach((notification, index) => {
    const cleanBody = notification.body
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
    const date = new Date(notification.createdAt).toLocaleDateString("ru-RU");
    
    message += `${index + 1}. <b>${notification.title}</b>\n`;
    message += `   📅 ${date}\n`;
    message += `   ${cleanBody}\n\n`;
  });

  return message;
}

module.exports = { 
  getNotifications, 
  filterAssignmentNotifications, 
  formatNotificationMessage,
  formatNotificationsList 
};