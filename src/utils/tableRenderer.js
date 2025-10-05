const { createCanvas } = require("canvas");


async function renderScheduleTable(days) {
  
  const columnSteps = [50, 200, 450, 700, 900];
  const columnWidths = [140, 240, 240, 190, 160]; 
  const canvasWidth = 1100;
  const headerHeight = 80;
  const rowHeight = 40; 
  const daySpacing = 30;
  
  
  const today = new Date().toLocaleString('ru-RU', { weekday: 'long' });
  const todayLower = today.toLowerCase();
  
  
  let totalHeight = headerHeight;
  Object.values(days).forEach(lessons => {
    totalHeight += (lessons.length * rowHeight) + daySpacing;
  });
  
  const canvas = createCanvas(canvasWidth, totalHeight + 50);
  const ctx = canvas.getContext("2d");

  
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  
  ctx.fillStyle = "#2c3e50";
  ctx.font = "bold 24px Arial";
  const title = `Расписание на неделю (сегодня: ${today})`;
  const titleWidth = ctx.measureText(title).width;
  ctx.fillText(title, (canvasWidth - titleWidth) / 2, 40);

  
  ctx.fillStyle = "#34495e";
  ctx.font = "bold 16px Arial";
  const headers = ["День", "Время", "Дисциплина", "Преподаватель", "Аудитория"];
  
  let y = 70;
  headers.forEach((header, i) => {
    const x = columnSteps[i];
    ctx.fillText(header, x, y);
  });

  
  ctx.strokeStyle = "#bdc3c7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, y + 5);
  ctx.lineTo(canvasWidth - 40, y + 5);
  ctx.stroke();

  y += 25;

  
  ctx.font = "14px Arial";

  
  Object.entries(days).forEach(([day, lessons], dayIndex) => {
    
    const isToday = day.toLowerCase().includes(todayLower) || 
                   todayLower.includes(day.toLowerCase());
    
    
    let dayGroupColor;
    if (isToday) {
      dayGroupColor = "#e8f4f8"; 
    } else {
      dayGroupColor = dayIndex % 2 === 0 ? "#f8f9fa" : "#ffffff"; 
    }
    
    
    const dayBlockHeight = lessons.length * rowHeight;
    
    
    ctx.fillStyle = dayGroupColor;
    ctx.fillRect(40, y - 15, canvasWidth - 80, dayBlockHeight + 15);
    
    
    if (isToday) {
      ctx.strokeStyle = "#3498db";
      ctx.lineWidth = 2;
      ctx.strokeRect(40, y - 15, canvasWidth - 80, dayBlockHeight + 15);
    }
    
    
    const textColor = isToday ? "#2c3e50" : "#2c3e50";
    const accentColor = isToday ? "#e74c3c" : "#7f8c8d";
    const linkColor = isToday ? "#3498db" : "#2980b9";
    
    
    ctx.fillStyle = accentColor;
    ctx.font = isToday ? "bold 16px Arial" : "bold 15px Arial";
    ctx.fillText(isToday ? `${day}` : day, columnSteps[0], y);
    
    
    ctx.font = isToday ? "14px Arial" : "14px Arial";
    
    
    let lessonY = y;
    lessons.forEach((lesson, lessonIndex) => {
      ctx.fillStyle = textColor;
      
      
      if (lessonIndex > 0) {
        ctx.fillText("", columnSteps[0], lessonY);
      }
      
      
      ctx.fillText(lesson.time, columnSteps[1], lessonY);
      
      
      const disciplineLines = wrapText(ctx, lesson.discipline, columnWidths[2], 14);
      disciplineLines.forEach((line, lineIndex) => {
        ctx.fillText(line, columnSteps[2], lessonY + (lineIndex * 16));
      });
      
      
      const teacherLines = wrapText(ctx, lesson.teacher, columnWidths[3], 14);
      teacherLines.forEach((line, lineIndex) => {
        ctx.fillText(line, columnSteps[3], lessonY + (lineIndex * 16));
      });
      
      
      const classroomText = truncateText(ctx, lesson.classroom, columnWidths[4]);
      ctx.fillText(classroomText, columnSteps[4], lessonY);
      
      
      if (lesson.link) {
        ctx.font = "italic 12px Arial";
        ctx.fillStyle = linkColor;
        const linkText = truncateText(ctx, `📎 ${lesson.link}`, columnWidths[4] - 20);
        ctx.fillText(linkText, columnSteps[4], lessonY + 18);
        ctx.font = "14px Arial";
        ctx.fillStyle = textColor;
      }
      
      
      if (lessonIndex < lessons.length - 1) {
        ctx.strokeStyle = isToday ? "#d6eaf8" : "#f1f1f1";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(columnSteps[1], lessonY + 20);
        ctx.lineTo(canvasWidth - 40, lessonY + 20);
        ctx.stroke();
      }
      
      lessonY += rowHeight;
    });
    
    y += dayBlockHeight + daySpacing;
    
    
    if (Object.keys(days).indexOf(day) < Object.keys(days).length - 1) {
      ctx.strokeStyle = isToday ? "#3498db" : "#ecf0f1";
      ctx.lineWidth = isToday ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(40, y - 20);
      ctx.lineTo(canvasWidth - 40, y - 20);
      ctx.stroke();
    }
  });

  
  ctx.strokeStyle = "#ecf0f1";
  ctx.lineWidth = 1;
  columnSteps.forEach((x, index) => {
    if (index > 0) {
      ctx.beginPath();
      ctx.moveTo(x - 15, 65);
      ctx.lineTo(x - 15, y - daySpacing - 5);
      ctx.stroke();
    }
  });

  
  ctx.strokeStyle = "#bdc3c7";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 55, canvasWidth - 80, y - daySpacing - 60);

  return canvas.toBuffer("image/png");
}


function truncateText(ctx, text, maxWidth) {
  const ellipsis = "...";
  if (ctx.measureText(text).width <= maxWidth) return text;
  
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const testText = text.substring(0, i + 1) + ellipsis;
    if (ctx.measureText(testText).width > maxWidth) {
      break;
    }
    result = text.substring(0, i + 1);
  }
  return result + ellipsis;
}


function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  
  
  if (lines.length > 2) {
    return [lines[0], truncateText(ctx, lines[1] + "...", maxWidth)];
  }
  
  return lines;
}

module.exports = { renderScheduleTable };