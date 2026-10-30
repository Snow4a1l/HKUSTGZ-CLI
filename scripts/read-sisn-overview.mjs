// Pass this function to the supported Browser tab.playwright.evaluate API.
// Reads only rendered timetable text, never application state or credentials.
export function readSisnOverview() {
  return [...document.querySelectorAll('.table-list-main')].map(column => ({
    heading: column.querySelector('.table-title')?.innerText.trim(),
    cards: [...column.querySelectorAll('.table-data-item')].map(card => card.innerText.trim())
  }));
}
