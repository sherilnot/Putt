/**
 * Week & Deadline Utilities for Puttum Kadalayum Meal Planning
 *
 * For a week starting Monday M (Monday–Sunday), all in mess time (Australia/Sydney):
 *  - the manager sets that week's menu from Sunday M-8 until Monday M-7 at 11:59:59 PM
 *  - customers choose their meals from Wednesday M-5 until Thursday M-4 at 11:59:59 PM
 */

/**
 * Get Monday 00:00:00 for the week containing `date`
 */
function getWeekMonday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // In JS: 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

/**
 * Get the Monday for the following/next week
 */
function getNextWeekMonday(date = new Date()) {
  const thisMonday = getWeekMonday(date);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  return nextMonday;
}

/**
 * Get the Sunday 23:59:59 for a given Monday
 */
function getWeekSunday(mondayDate) {
  const sunday = new Date(mondayDate);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Get selection deadline for a target week starting on `targetMonday`.
 * The deadline is the Thursday prior to the target Monday at 23:59:59.
 * (i.e. targetMonday minus 4 days: Mon - 4 = Thu)
 */
function getSelectionDeadline(targetMonday) {
  const deadline = new Date(targetMonday);
  deadline.setDate(deadline.getDate() - 4);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

/** Start of the day `days` days before `monday` */
function daysBefore(monday, days) {
  const d = new Date(monday);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The manager's menu window for the week starting `monday`: Sunday → Monday 11:59 PM */
function getMenuWindow(monday) {
  const closesAt = daysBefore(monday, 7);
  closesAt.setHours(23, 59, 59, 999);
  return { opensAt: daysBefore(monday, 8), closesAt };
}

/** The customers' choice window for the week starting `monday`: Wednesday → Thursday 11:59 PM */
function getChoiceWindow(monday) {
  return { opensAt: daysBefore(monday, 5), closesAt: getSelectionDeadline(monday) };
}

/** Monday of the week whose menu the manager is (or will next be) setting */
function getMenuWeekMonday(currentDate = new Date()) {
  const monday = getNextWeekMonday(currentDate);
  while (getMenuWindow(monday).closesAt < currentDate) monday.setDate(monday.getDate() + 7);
  return monday;
}

/**
 * Check if the selection for a target week is locked based on current time
 */
function isSelectionLocked(targetMonday, currentDate = new Date()) {
  const deadline = getSelectionDeadline(targetMonday);
  return new Date(currentDate) > deadline;
}

/**
 * Monday of the first week whose meal selection is still open
 * (next week, or the week after once Thursday's cutoff has passed).
 */
function getFirstOpenWeekMonday(currentDate = new Date()) {
  const monday = getNextWeekMonday(currentDate);
  if (isSelectionLocked(monday, currentDate)) {
    monday.setDate(monday.getDate() + 7);
  }
  return monday;
}

/**
 * Generate 7 dates (Monday through Sunday) for a week starting on `mondayDate`
 */
function getDaysForWeek(mondayDate) {
  const dayNames = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  return dayNames.map((name, index) => {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + index);
    return {
      dayName: name,
      date: d,
    };
  });
}

/**
 * Format a date nicely (e.g. "Monday, September 21")
 */
function formatDayHeader(date) {
  return new Date(date).toLocaleDateString('en-AU', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format deadline (e.g. "Thursday, September 17 at 11:59 PM")
 */
function formatDeadline(deadlineDate) {
  const d = new Date(deadlineDate);
  const dateStr = d.toLocaleDateString('en-AU', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  return `${dateStr} at 11:59 PM`;
}

module.exports = {
  getWeekMonday,
  getNextWeekMonday,
  getWeekSunday,
  getSelectionDeadline,
  isSelectionLocked,
  getFirstOpenWeekMonday,
  getMenuWindow,
  getChoiceWindow,
  getMenuWeekMonday,
  getDaysForWeek,
  formatDayHeader,
  formatDeadline,
};
