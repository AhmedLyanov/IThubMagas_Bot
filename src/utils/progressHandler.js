const axios = require("axios");
const QuickChart = require("quickchart-js");
const { API_URL } = require("../config");
const { userSessions } = require("../bot");


async function getStudentProgress(token, studentId) {
  const query = `
    query DiaryQuery($studentId: UUID!) {
      searchStudentDisciplines(input: { studentId: $studentId }) {
        discipline {
          name
          code
          archivedAt
        }
        disciplineGrade
        maxScoreForAnsweredTasks
        scoreForAnsweredTasks
      }
    }`;

  try {
    const response = await axios.post(
      API_URL,
      { query, variables: { studentId } },
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) throw new Error(response.data.errors[0].message);

    
    const allDisciplines = response.data.data.searchStudentDisciplines;
    return allDisciplines.filter(
      (d) =>
        !d.discipline.archivedAt && 
        d.maxScoreForAnsweredTasks > 0 
    );
  } catch (err) {
    console.error("Ошибка загрузки успеваемости:", err.message);
    throw err;
  }
}


async function renderProgressChart(diaryData) {
  
  const sortedData = [...diaryData].sort((a, b) => {
    const percentA = (a.scoreForAnsweredTasks / a.maxScoreForAnsweredTasks) * 100;
    const percentB = (b.scoreForAnsweredTasks / b.maxScoreForAnsweredTasks) * 100;
    return percentB - percentA;
  });

  const labels = sortedData.map((d) => {
    
    const name = d.discipline.name;
    return name.length > 30 ? name.substring(0, 30) + "..." : name;
  });
  
  const scores = sortedData.map((d) => d.scoreForAnsweredTasks || 0);
  const maxScores = sortedData.map((d) => d.maxScoreForAnsweredTasks || 100);

  const percentages = sortedData.map((d, i) =>
    Math.round((scores[i] / maxScores[i]) * 100)
  );

  
  const backgroundColors = percentages.map(percent => {
    if (percent >= 80) return 'rgba(40, 167, 69, 0.85)'; 
    if (percent >= 60) return 'rgba(23, 162, 184, 0.85)'; 
    if (percent >= 40) return 'rgba(255, 193, 7, 0.85)'; 
    return 'rgba(220, 53, 69, 0.85)'; 
  });

  const chart = new QuickChart();

  chart.setConfig({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Процент выполнения",
          data: percentages,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color.replace('0.85', '1')),
          borderWidth: 1.5,
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "📊 Успеваемость по дисциплинам",
          font: { 
            size: 22, 
            weight: "bold",
            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
          },
          color: '#2c3e50',
          padding: { top: 10, bottom: 25 }
        },
        legend: { 
          display: false 
        },
        tooltip: {
          backgroundColor: 'rgba(44, 62, 80, 0.95)',
          titleFont: {
            size: 14,
            weight: 'bold',
            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
          },
          bodyFont: {
            size: 13,
            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
          },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const index = context.dataIndex;
              return [
                `Процент: ${context.parsed.y}%`,
                `Баллы: ${scores[index]} / ${maxScores[index]}`,
                `Дисциплина: ${sortedData[index].discipline.name}`
              ];
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "top",
          color: "#2c3e50",
          font: { 
            size: 11, 
            weight: "bold",
            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
          },
          formatter: (value) => `${value}%`,
          offset: 4
        },
      },
      layout: {
        padding: {
          top: 10,
          right: 15,
          bottom: 10,
          left: 15
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { 
            stepSize: 20, 
            color: "#5d6d7e",
            font: {
              size: 11,
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
            },
            padding: 8
          },
          title: { 
            display: true, 
            text: "Процент выполнения (%)", 
            color: "#34495e",
            font: {
              size: 13,
              weight: 'bold',
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
            }
          },
          grid: { 
            color: "rgba(52, 73, 94, 0.1)",
            drawBorder: false
          },
        },
        x: {
          ticks: {
            color: "#34495e",
            font: { 
              size: 10,
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
            },
            maxRotation: 45,
            minRotation: 30,
          },
          grid: { 
            display: false
          },
        },
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    },
  });

  chart.setWidth(1000);
  chart.setHeight(600);
  chart.setBackgroundColor("#ffffff");
  chart.setDevicePixelRatio(2.0); 

  return await chart.toBinary();
}


function generateProgressSummary(diaryData) {
  if (!diaryData || diaryData.length === 0) return "";

  const totalPercent = diaryData.reduce((sum, d) => {
    return sum + (d.scoreForAnsweredTasks / d.maxScoreForAnsweredTasks) * 100;
  }, 0);
  
  const averagePercent = Math.round(totalPercent / diaryData.length);
  
  const completedDisciplines = diaryData.filter(d => 
    (d.scoreForAnsweredTasks / d.maxScoreForAnsweredTasks) >= 0.8
  ).length;

  return `\n\n **Статистика:**\n` +
         `• Средний процент: **${averagePercent}%**\n` +
         `• Дисциплин с выполнением >80%: **${completedDisciplines} из ${diaryData.length}**\n` +
         `• Всего активных дисциплин: **${diaryData.length}**`;
}

async function handleProgress(bot, chatId) {
  const session = userSessions[chatId];
  if (!session?.token) {
    await bot.sendMessage(
      chatId,
      "Вы не авторизованы. Введите /start для начала работы."
    );
    return;
  }

  try {
    await bot.sendMessage(chatId, "📊 Загружаю данные текущего курса...");
    const diary = await getStudentProgress(session.token, session.studentId);

    if (!diary || diary.length === 0) {
      await bot.sendMessage(
        chatId,
        "Данные успеваемости для текущего курса не найдены.\n\n"
      );
      return;
    }

    const imageBuffer = await renderProgressChart(diary);
    const summaryText = generateProgressSummary(diary);

    await bot.sendPhoto(chatId, imageBuffer, {
      caption: `🎓 **Ваша текущая успеваемость**${summaryText}\n\n` +
               `_Данные обновлены: ${new Date().toLocaleDateString('ru-RU')}_`,
      parse_mode: "Markdown"
    });

  } catch (error) {
    console.error("Ошибка /progress:", error);
    await bot.sendMessage(
      chatId,
      "Не удалось загрузить успеваемость. Попробуйте позже.\n\n" +
      "Если проблема повторяется, обратитесь в техническую поддержку."
    );
  }
}

module.exports = { handleProgress };