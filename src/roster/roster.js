const { getTeamMembers } = require('../db/db');

function generateCalendarKeyboard(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const weeks = [];
  let week = Array(7).fill(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayIndex = (firstDay + day - 1) % 7;
    week[dayIndex] = { text: String(day), callback_data: `select_date:${date}` };
    if (dayIndex === 6 || day === daysInMonth) {
      weeks.push(week);
      week = Array(7).fill(null);
    }
  }

  const keyboard = [
    [{ text: `${monthNames[month]} ${year}`, callback_data: 'noop' }],
    [
      { text: 'Sun', callback_data: 'noop' },
      { text: 'Mon', callback_data: 'noop' },
      { text: 'Tue', callback_data: 'noop' },
      { text: 'Wed', callback_data: 'noop' },
      { text: 'Thu', callback_data: 'noop' },
      { text: 'Fri', callback_data: 'noop' },
      { text: 'Sat', callback_data: 'noop' }
    ],
    ...weeks.map(w => w.map(cell => cell || { text: ' ', callback_data: 'noop' })),
    [
      { text: 'Previous Month', callback_data: `prev_month:${year}:${month}` },
      { text: 'Next Month', callback_data: `next_month:${year}:${month}` }
    ],
    [{ text: 'Confirm Dates', callback_data: 'confirm_dates' }]
  ];

  return keyboard;
}

async function generateTeamMemberKeyboard(team) {
  const members = await getTeamMembers(team);
  const keyboard = members.map(member => [
    { text: member.full_name, callback_data: `select_member:${member.telegram_id}` }
  ]);
  return keyboard.length ? keyboard : [[{ text: 'No team members', callback_data: 'noop' }]];
}

module.exports = {
  generateCalendarKeyboard,
  generateTeamMemberKeyboard
};