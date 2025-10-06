const axios = require("axios");
const { API_URL } = require("./config");

async function getSchedule(token) {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - today.getDay() + 1); 
  const toDate = new Date(fromDate);
  toDate.setDate(fromDate.getDate() + 6); 

  const from = fromDate.toISOString().split("T")[0]; 
  const to = toDate.toISOString().split("T")[0];

  const query = `
    query ManyClassesForSchedule($input: ManyClassesInput!, $isAdministrationSchedule: Boolean = false) {
      manyClasses(input: $input) {
        ...ClassInScheduleFragment
        __typename
      }
    }
    fragment ClassInScheduleFragment on Class {
      id
      from
      to
      name
      role
      isOnline
      isAutoMeetingLink
      meetingLink
      suborganizationId
      suborganization { id name __typename }
      retakingGroup { id name disciplineId __typename }
      discipline { id name code archivedAt templateDiscipline { id disciplinesGroup { id name __typename } __typename } suborganization { id organizationId __typename } __typename }
      learningGroup { id name isArchived __typename }
      classroom { id name buildingArea { id name __typename } __typename }
      teacher { id user { id firstName lastName middleName __typename } __typename }
      teachers { id user { id firstName lastName middleName __typename } __typename }
      flow { id name learningGroups { id name __typename } __typename }
      hasAttendance @include(if: $isAdministrationSchedule)
      errors { ...ClassParamsErrorsFragment __typename }
      ctpTopics { id name __typename }
      __typename
    }
    fragment ClassParamsErrorsFragment on ClassParamsErrors {
      buildingArea classroom discipline teacher teachers classCount classTime learningGroup __typename
    }
  `;

  const variables = {
    input: {
      page: 1,
      pageSize: 50,
      filters: {
        roles: ["STUDENT"],
        interval: { from, to }
      }
    },
    isAdministrationSchedule: false
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

    return response.data.data.manyClasses;
  } catch (error) {
    console.error("Ошибка получения расписания:", error.message);
    throw error;
  }
}

function formatSchedule(classes) {
  const days = {};
  const dayNames = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

  classes.forEach(cls => {
    const dayIndex = new Date(cls.from).getDay() || 7; 
    const dayName = dayNames[dayIndex - 1];

    if (!days[dayName]) days[dayName] = [];
    const timeFrom = new Date(cls.from).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const timeTo = new Date(cls.to).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const discipline = cls.discipline?.name || "Не указано";
    const teacher = cls.teachers?.[0]?.user ? `${cls.teachers[0].user.lastName} ${cls.teachers[0].user.firstName.charAt(0)}.` : "Не указано";
    const classroom = cls.classroom ? `${cls.classroom.name}` : "Не указано";
    const link = cls.isOnline && cls.meetingLink ? cls.meetingLink : "";

    days[dayName].push({
      time: `${timeFrom}-${timeTo}`,
      discipline,
      teacher,
      classroom,
      link
    });
  });

  Object.keys(days).forEach(day => {
    days[day] = days[day].sort((a, b) => a.time.localeCompare(b.time));
  });

  return days;
}

module.exports = { getSchedule, formatSchedule };