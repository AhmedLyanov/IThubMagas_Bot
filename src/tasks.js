const axios = require("axios");
const { API_URL } = require("./config");

async function getTasksWithDeadlines(token, studentId) {
  try {
    const query = `
      query StudentAvailableTasks($input: StudentAvailableTasksInput!) {
        studentAvailableTasks(input: $input) {
          items {
            kind
            taskDeadline
            contentBlock { 
              ... on TaskDisciplineTopicContentBlock {
                id
                name
              }
              ... on TestDisciplineTopicContentBlock {
                id
                name
              }
            }
            topic { 
              name 
              id 
            }
          }
        }
      }
    `;

    const variables = {
      input: {
        studentId: studentId,
        pageSize: 50,
        page: 1,
        filters: {
          fromArchivedDiscipline: false,
        },
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
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL Errors:", response.data.errors);
      throw new Error(response.data.errors[0].message);
    }

    return response.data.data.studentAvailableTasks.items
      .filter((task) => task.taskDeadline)
      .map((task) => ({
        name: task.contentBlock?.name || "Без названия",
        topic: task.topic?.name || "Без темы",
        deadline: new Date(task.taskDeadline),
        type: task.kind === "TASK" ? "Учебная практика" : "Тест",
        contentId: task.contentBlock?.id,
        topicId: task.topic?.id,
        link:
          task.contentBlock?.id && task.topic?.id
            ? `https://newlxp.ru/topics/${task.topic.id}/content/${task.contentBlock.id}`
            : null,
      }));
  } catch (error) {
    console.error("Ошибка получения заданий:", {
      message: error.message,
      response: error.response?.data,
      config: error.config,
    });
    throw error;
  }
}

function getDayText(days) {
  if (days % 10 === 1 && days % 100 !== 11) return "день";
  if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100))
    return "дня";
  return "дней";
}

function getHourText(hours) {
  if (hours % 10 === 1 && hours % 100 !== 11) return "час";
  if ([2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100))
    return "часа";
  return "часов";
}

module.exports = { getTasksWithDeadlines, getDayText, getHourText };