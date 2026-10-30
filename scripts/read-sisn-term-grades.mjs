// Pass to tab.playwright.getByRole('tabpanel', {name:'My Term Information', exact:true}).evaluate.
// The identity fields outside this tabpanel are deliberately excluded.
export function readSisnTermTables(panel) {
  return [...panel.querySelectorAll('table')].map(table => [...table.querySelectorAll('tr')]
    .map(row => [...row.querySelectorAll('th,td')].map(cell => cell.innerText.trim())));
}
