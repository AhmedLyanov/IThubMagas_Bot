const axios = require("axios");
const { API_URL } = require("./config");

async function getTasksWithDeadlines(token, studentId) {
  try {
    const query = `
      query StudentAvailableTasks($input: StudentAvailableTasksInput!, $studentId: UUID!) {
        studentAvailableTasks(input: $input) {
          hasMore
          page
          perPage
          total
          totalPages
          items {
            ...StudentContentBlockInStudentTaskListFragment
            __typename
          }
          __typename
        }
      }

      fragment StudentContentBlockInStudentTaskListFragment on StudentContentBlock {
        contentBlock {
          ... on TaskDisciplineTopicContentBlock {
            id
            kind
            name
            maxScore
            __typename
          }
          ... on TestDisciplineTopicContentBlock {
            id
            name
            kind
            testMaxScore: maxScore
            canBePassed(studentId: $studentId)
            testId
            __typename
          }
          __typename
        }
        taskDeadline
        customTaskDeadline {
          deadline
          formEducation {
            comment
            finishedAt
            form
            id
            startedAt
            studentId
            __typename
          }
          __typename
        }
        testScore
        testInterval {
          from
          to
          __typename
        }
        customTestInterval {
          interval {
            from
            to
            __typename
          }
          formEducation {
            comment
            finishedAt
            form
            id
            startedAt
            studentId
            __typename
          }
          __typename
        }
        studentTopic {
          status
          __typename
        }
        topic {
          id
          name
          chapterId
          isCheckPoint
          isForPortfolio
          chapter {
            id
            name
            discipline {
              id
              name
              archivedAt
              suborganization {
                organization {
                  timezoneMinutesOffset
                  __typename
                }
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
        task {
          id
          scoreInPercent
          answers {
            createdAt
            id
            commentsCount
            __typename
          }
          createdAt
          __typename
        }
        __typename
      }
    `;

    const variables = {
      input: {
        studentId: studentId,
        pageSize: 10,
        page: 1,
        filters: {
          query: "",
          status: null,
          organizationId: "04329772-ff8b-4123-a65b-298e1fa799fb"
        }
      },
      studentId: studentId
    };

    const response = await axios.post(
      API_URL,
      {
        operationName: "StudentAvailableTasks",
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
      .filter((task) => task.taskDeadline || task.customTaskDeadline?.deadline)
      .map((task) => {
        const deadline = task.customTaskDeadline?.deadline || task.taskDeadline;
        const contentBlock = task.contentBlock;
        
        return {
          name: contentBlock?.name || "Без названия",
          topic: task.topic?.name || "Без темы",
          deadline: new Date(deadline),
          kind: contentBlock?.kind,
          maxScore: contentBlock?.maxScore || contentBlock?.testMaxScore,
          taskId: task.task?.id,
          testId: contentBlock?.testId,
          link: "https://newlxp.ru/education/04329772-ff8b-4123-a65b-298e1fa799fb/exercises",
        };
      });
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