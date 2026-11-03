const {
  getWeekMonday,
  getNextWeekMonday,
  getWeekSunday,
  getSelectionDeadline,
  isSelectionLocked,
  formatDeadline,
  formatDayHeader,
} = require('./weekUtils');

function runTests() {
  console.log('--- RUNNING WEEK UTILS & DEADLINE TESTS ---');

  // Test Case from User Prompt:
  // "If the current date is Monday, September 14, the customer is selecting meals for the week of September 21–27.
  // They must complete their selection by Thursday, September 17."
  // Note: Months in JS Date are 0-indexed (8 = September)
  const testDate = new Date(2026, 8, 14, 10, 0, 0); // Mon Sep 14, 2026
  const thisMonday = getWeekMonday(testDate);
  const nextMonday = getNextWeekMonday(testDate);
  const nextSunday = getWeekSunday(nextMonday);
  const deadline = getSelectionDeadline(nextMonday);

  console.log('Current Date:', testDate.toDateString());
  console.log('Target Week Monday:', nextMonday.toDateString());
  console.log('Target Week Sunday:', nextSunday.toDateString());
  console.log('Selection Deadline:', deadline.toString());
  console.log('Deadline formatted:', formatDeadline(deadline));

  // Assertions
  if (nextMonday.getDate() !== 21 || nextMonday.getMonth() !== 8) {
    throw new Error(`Expected nextMonday to be Sep 21, got ${nextMonday.toDateString()}`);
  }
  if (nextSunday.getDate() !== 27 || nextSunday.getMonth() !== 8) {
    throw new Error(`Expected nextSunday to be Sep 27, got ${nextSunday.toDateString()}`);
  }
  if (deadline.getDate() !== 17 || deadline.getMonth() !== 8) {
    throw new Error(`Expected deadline date to be Sep 17, got ${deadline.toDateString()}`);
  }
  if (deadline.getHours() !== 23 || deadline.getMinutes() !== 59) {
    throw new Error(`Expected deadline time 23:59, got ${deadline.getHours()}:${deadline.getMinutes()}`);
  }

  // Test Lock Behavior:
  // Before deadline: Wednesday Sep 16, or Thursday Sep 17 at 8 PM
  const wednesday = new Date(2026, 8, 16, 12, 0, 0);
  const thursdayEvening = new Date(2026, 8, 17, 20, 0, 0);
  if (isSelectionLocked(nextMonday, wednesday) !== false) {
    throw new Error('Expected Wednesday to be UNLOCKED');
  }
  if (isSelectionLocked(nextMonday, thursdayEvening) !== false) {
    throw new Error('Expected Thursday 8 PM to be UNLOCKED');
  }

  // After deadline: Thursday Sep 17 at 23:59:59.999 is cutoff; Friday Sep 18 at 00:01 AM is locked!
  const friday = new Date(2026, 8, 18, 0, 1, 0);
  const saturday = new Date(2026, 8, 19, 10, 0, 0);
  if (isSelectionLocked(nextMonday, friday) !== true) {
    throw new Error('Expected Friday to be LOCKED');
  }
  if (isSelectionLocked(nextMonday, saturday) !== true) {
    throw new Error('Expected Saturday to be LOCKED');
  }

  console.log('ALL DEADLINE AND LOCKING TESTS PASSED PERFECTLY!');
}

runTests();
