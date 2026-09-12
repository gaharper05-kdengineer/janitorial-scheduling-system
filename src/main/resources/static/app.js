// Frontend for the main schedule page (index.html). Plain HTML/CSS/JS, no
// build step or framework -- Spring Boot serves this directly as a static
// file. Deliberately written dense (multiple statements per line, template
// literals for markup) rather than split across many small files; comments
// below focus on WHY things work the way they do, not what each line does.
//
// Rough map of what's below:
//   - state/formatting helpers (state, regularTime, to24HourTime, hours math)
//   - render(): rebuilds the whole schedule table from state
//   - load*()/bootstrap(): fetches data from the backend on page load
//   - role-gated UI: loadRole() sets state.canManage/.role and toggles the
//     `view-only` / `is-admin` body classes that styles.css keys off of
//   - dialogs: shift add/edit, employee edit, admin (manage managers,
//     system status), credentials, delete confirmation
//   - shift-menu vs shift-detail-popover: managers tap a shift to get an
//     edit/copy/delete menu; view-only (employee) sessions instead get a
//     read-only popover showing the full time range (see openShiftDetail)
//   - mouse drag-to-move/duplicate a shift (desktop only -- touch devices
//     use the copy/paste menu items instead, see pasteCopiedShift)
//
// Same-origin check as a cheap "am I running against the real deployed app
// or a local dev/demo instance" signal, purely cosmetic (swaps the location
// badge/title to make DEMO MODE obvious) -- has no effect on what data is
// loaded or which backend is talked to.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  document.querySelectorAll('.location-badge').forEach(el => {
    el.textContent = 'DEMO MODE';
    el.style.background = 'var(--yellow)';
    el.style.color = '#7a5c05';
  });
  document.title = document.title.replace('COSM - Atlanta', 'DEMO MODE');
}
const state = { weekStart: monday(new Date()), shifts: [], employees: [], role: 'EMPLOYEE', canManage: false };
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function monday(date) { const result = new Date(date); const day = result.getDay(); result.setDate(result.getDate() - (day === 0 ? 6 : day - 1)); result.setHours(0, 0, 0, 0); return result; }
function iso(date) { return date.toISOString().slice(0, 10); }
function displayDate(date) { return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
// Spring Security's cookie-based CSRF: the server writes the current token
// into a readable XSRF-TOKEN cookie (see CsrfCookieFilter/SecurityConfig on
// the backend), and we echo it back as a header on every mutating request.
// Call this fresh right before each fetch rather than caching the headers --
// the token can rotate (e.g. right after login), and a stale token gets a
// 403.
function csrfHeaders() {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? { 'X-XSRF-TOKEN': decodeURIComponent(match[1]) } : {};
}
async function logout() {
  await fetch('/logout', { method: 'POST', headers: csrfHeaders() });
  window.location.href = '/login.html?logout';
}
// Displays a stored time (either "H:mm" 24-hour or already "h:mm AM/PM") as
// "h:mm AM/PM" for the schedule grid and dialogs.
function regularTime(value) {
  if (!value) return '';
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3];
  if (meridiem) {
    hour = hour === 0 ? 12 : hour;
    return `${hour}:${minute} ${meridiem.toUpperCase()}`;
  }
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const regularHour = hour % 12 || 12;
  return `${regularHour}:${minute} ${suffix}`;
}
// The inverse of regularTime(): converts a stored time to "HH:mm" so it can
// populate a native <input type="time">, which requires 24-hour format.
function to24HourTime(value) {
  if (!value) return '';
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3];
  if (meridiem) {
    hour = hour % 12;
    if (meridiem.toUpperCase() === 'PM') hour += 12;
  }
  return `${String(hour).padStart(2, '0')}:${minute}`;
}
// Mirrors Shift.LUNCH_ELIGIBLE_MINUTES on the backend (both must agree, or
// the "Calculated hours" preview in the Add Shift dialog would disagree
// with what the server actually saves) -- a lunch deduction only applies to
// shifts longer than 6 hours.
const LUNCH_ELIGIBLE_MINUTES = 6 * 60;
function effectiveLunchMinutes(start, end, lunchMinutes = 0) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes > LUNCH_ELIGIBLE_MINUTES ? Math.max(0, Number(lunchMinutes || 0)) : 0;
}
function calculatedHours(start, end, lunchMinutes = 0) {
  if (!start || !end) return null;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes <= 0) minutes += 24 * 60;
  const adjustedMinutes = Math.max(0, minutes - effectiveLunchMinutes(start, end, lunchMinutes));
  return adjustedMinutes / 60;
}
function updateCalculatedHours() {
  const form = document.querySelector('#shift-form');
  const lunchMinutes = Number(form.lunchMinutes.value || 0);
  const hours = calculatedHours(form.startTime.value, form.endTime.value, lunchMinutes);
  document.querySelector('#calculated-hours').value = hours === null ? 'No time set (optional)' : `${hours.toFixed(2)} hours`;
}
function renderHead() { document.querySelector('#schedule-head').innerHTML = `<tr><th>Employee</th>${days.map((day, index) => { const date = new Date(state.weekStart); date.setDate(date.getDate() + index); return `<th><span class="day-name">${day}</span><span class="day-date">${displayDate(date)}</span></th>`; }).join('')}<th>Total</th></tr>`; }
// Rebuilds the entire schedule table from state.shifts/state.employees.
// Called after every load and every successful mutation -- there's no
// incremental DOM patching, the whole tbody is replaced each time.
function render() {
  renderHead();
  // The employee list for the table is the union of the roster
  // (state.employees, manager-only -- see loadWeek) and whoever has a shift
  // this week, so a name with a shift but no roster row (or vice versa)
  // still shows up.
  const rosterNames = state.employees.map(employee => employee.name);
  const shiftNames = state.shifts.map(shift => shift.employeeName);
  const shiftTypeOrder = { day: 0, swing: 1, overnight: 2 };
  // Groups employees by their most common shift type this week (day, then
  // evening, then overnight), so the table reads as clusters of similar
  // shifts rather than a flat alphabetical list.
  const employees = [...new Set([...rosterNames, ...shiftNames])]
    .map(name => {
      const employeeShifts = state.shifts.filter(shift => shift.employeeName === name);
      const counts = { day: 0, swing: 0, overnight: 0 };
      employeeShifts.forEach(shift => { if (counts[shift.shiftType] !== undefined) counts[shift.shiftType]++; });
      const predominantType = employeeShifts.length
        ? Object.keys(counts).reduce((best, type) => counts[type] > counts[best] ? type : best, 'day')
        : null;
      return { name, employeeShifts, groupOrder: predominantType === null ? 3 : shiftTypeOrder[predominantType] };
    })
    .sort((a, b) => a.groupOrder - b.groupOrder || a.name.localeCompare(b.name));
  const body = document.querySelector('#schedule-body');
  body.innerHTML = employees.length ? employees.map(({ name, employeeShifts }) => {
    const total = employeeShifts.reduce((sum, shift) => sum + Number(shift.hours), 0);
    const rosterMatch = state.employees.find(employee => employee.name === name);
    const onCall = rosterMatch ? rosterMatch.onCall : employeeShifts.some(shift => shift.employeeOnCall);
    const cells = days.map((_, index) => {
      const date = new Date(state.weekStart); date.setDate(date.getDate() + index);
      const dateIso = iso(date);
      const shift = employeeShifts.find(item => item.shiftDate === dateIso);
      const emptyAttrs = shift ? '' : ` data-employee-name="${escapeHtml(name)}" role="button" tabindex="0"`;
      const hasTime = Boolean(shift && shift.startTime && shift.endTime);
      return `<td class="shift-cell" data-shift-date="${dateIso}"${emptyAttrs}>${shift ? `<div class="shift ${shift.shiftType}" data-shift-id="${shift.id}" role="button" tabindex="0"><span class="shift-time">${hasTime ? `${regularTime(shift.startTime)} - ${regularTime(shift.endTime)}` : 'Time TBD'}</span>${hasTime ? `<span class="shift-hours">${Number(shift.hours).toFixed(2)} hrs</span>` : ''}${shift.onCall ? '<span class="on-call-badge">On call</span>' : ''}</div>` : ''}</td>`;
    }).join('');
    return `<tr data-employee-name="${escapeHtml(name)}"><td class="employee"><span class="employee-name" data-employee-name="${escapeHtml(name)}" role="button" tabindex="0">${escapeHtml(name)}</span>${onCall ? '<span class="on-call-badge">On call</span>' : ''}</td>${cells}<td class="total">${total.toFixed(2)}</td></tr>`;
  }).join('') : '<tr><td class="loading" colspan="9">No shifts scheduled for this week.</td></tr>';
  const totalHours = state.shifts.reduce((sum, shift) => sum + Number(shift.hours), 0);
  const budget = Number(document.querySelector('#budget').value) || 0;
  document.querySelector('#scheduled-hours').textContent = totalHours.toFixed(2);
  document.querySelector('#employee-count').textContent = employees.length;
  document.querySelector('#variance').textContent = `${(totalHours - budget).toFixed(2)} hrs`;
  document.querySelector('#variance').style.color = totalHours > budget ? '#ba4e5c' : 'var(--teal)';
  document.querySelector('#shift-count').textContent = `${state.shifts.length} shift${state.shifts.length === 1 ? '' : 's'}`;
  const end = new Date(state.weekStart); end.setDate(end.getDate() + 6);
  document.querySelector('#date-range').textContent = `${displayDate(state.weekStart)} - ${displayDate(end)}, ${end.getFullYear()}`;
}
async function loadWeek() {
  const response = await fetch(`/api/schedule?weekStart=${iso(state.weekStart)}`);
  state.shifts = response.ok ? await response.json() : [];
  if (state.canManage) await loadEmployees();
  await loadBudget();
  render();
}
async function loadEmployees() { const response = await fetch('/api/employees'); state.employees = response.ok ? await response.json() : []; }
async function loadBudget() {
  const response = await fetch(`/api/schedule/budget?weekStart=${iso(state.weekStart)}`);
  const body = response.ok ? await response.json() : { hours: 416 };
  document.querySelector('#budget').value = body.hours;
  document.querySelector('#budget-note').textContent = 'Budget saved for this week';
}
// Determines what UI this session gets. `view-only` (styles.css) hides every
// editing control for EMPLOYEE sessions; `is-admin` additionally reveals the
// ADMIN-only "Manage managers" / "System status" account-menu options. Real
// enforcement of what each role can actually do happens server-side
// (SecurityConfig) -- this is UI-only, so hiding a button here is a
// convenience, not the security boundary.
async function loadRole() {
  const response = await fetch('/api/account/me');
  const body = response.ok ? await response.json() : { role: 'EMPLOYEE' };
  state.role = body.role;
  state.canManage = state.role === 'MANAGER' || state.role === 'ADMIN';
  if (!state.canManage) document.body.classList.add('view-only');
  document.body.classList.toggle('is-admin', state.role === 'ADMIN');
}
async function bootstrap() {
  await loadRole();
  await loadWeek();
}
document.querySelector('#budget').addEventListener('input', () => {
  document.querySelector('#budget-note').textContent = 'Unsaved changes — click Save';
  render();
});
document.querySelector('#save-budget').addEventListener('click', async () => {
  const hours = Number(document.querySelector('#budget').value) || 0;
  const response = await fetch('/api/schedule/budget', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({ weekStart: iso(state.weekStart), hours })
  });
  if (response.ok) {
    document.querySelector('#budget-note').textContent = 'Budget saved for this week';
  } else {
    console.error('Failed to save budget:', await response.text());
    alert('Could not save budget. Please try again.');
  }
});
document.querySelector('#previous-week').addEventListener('click', () => { state.weekStart.setDate(state.weekStart.getDate() - 7); loadWeek(); });
document.querySelector('#next-week').addEventListener('click', () => { state.weekStart.setDate(state.weekStart.getDate() + 7); loadWeek(); });
function openNewShift(employeeName = '', shiftDate = '') { const form = document.querySelector('#shift-form'); form.reset(); form.shiftId.value = ''; form.employeeName.value = employeeName; form.shiftDate.value = shiftDate; document.querySelector('#dialog-title').textContent = 'Add employee shift'; updateCalculatedHours(); document.querySelector('#shift-dialog').showModal(); }
function openEditShift(shift) { const form = document.querySelector('#shift-form'); form.shiftId.value = shift.id; form.employeeName.value = shift.employeeName; form.shiftDate.value = shift.shiftDate; form.startTime.value = to24HourTime(shift.startTime); form.endTime.value = to24HourTime(shift.endTime); form.lunchMinutes.value = String(shift.lunchMinutes || 0); form.shiftType.value = shift.shiftType; form.onCall.checked = Boolean(shift.onCall); document.querySelector('#dialog-title').textContent = 'Edit employee shift'; updateCalculatedHours(); document.querySelector('#shift-dialog').showModal(); }
document.querySelector('#open-shift').addEventListener('click', () => openNewShift());
document.querySelector('#download-schedule').addEventListener('click', () => window.print());
document.querySelector('#logout-button').addEventListener('click', logout);
document.querySelector('#account-menu-button').addEventListener('click', event => {
  event.stopPropagation();
  const menu = document.querySelector('#account-menu');
  menu.hidden = !menu.hidden;
});
document.addEventListener('click', event => {
  const menu = document.querySelector('#account-menu');
  if (!menu.hidden && !event.target.closest('.account-menu-wrap')) menu.hidden = true;
});
document.addEventListener('keydown', event => {
  const menu = document.querySelector('#account-menu');
  if (event.key === 'Escape' && !menu.hidden) menu.hidden = true;
});
document.querySelector('#manage-managers-button').addEventListener('click', () => {
  document.querySelector('#account-menu').hidden = true;
  loadManagerList();
  document.querySelector('#admin-dialog').showModal();
});
document.querySelector('#admin-dialog-close').addEventListener('click', () => document.querySelector('#admin-dialog').close());
async function loadManagerList() {
  const list = document.querySelector('#manager-list');
  const response = await fetch('/api/admin/managers');
  const managers = response.ok ? await response.json() : [];
  list.innerHTML = managers.map(manager => `<div class="manager-row" data-id="${manager.id}"><span class="manager-username">${escapeHtml(manager.username)}</span><input type="password" class="reset-password-input" placeholder="New password"><button type="button" class="button button-quiet reset-password-btn" data-id="${manager.id}">Reset password</button></div>`).join('') || '<p class="metric-note">No manager accounts yet.</p>';
}
document.querySelector('#manager-list').addEventListener('click', async event => {
  const button = event.target.closest('.reset-password-btn');
  if (!button) return;
  const row = button.closest('.manager-row');
  const newPassword = row.querySelector('.reset-password-input').value;
  if (!newPassword) { alert('Enter a new password first.'); return; }
  const response = await fetch(`/api/admin/managers/${button.dataset.id}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({ newPassword })
  });
  if (response.ok) {
    row.querySelector('.reset-password-input').value = '';
    alert('Password reset.');
  } else {
    let message = 'Could not reset password. Please try again.';
    try { const body = await response.json(); if (body.message) message = body.message; } catch (ignored) {}
    alert(message);
  }
});
document.querySelector('#add-manager-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const response = await fetch('/api/admin/managers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({ username: formData.get('username'), password: formData.get('password') })
  });
  if (response.ok) {
    form.reset();
    await loadManagerList();
  } else {
    let message = 'Could not create manager account. Please try again.';
    try { const body = await response.json(); if (body.message) message = body.message; } catch (ignored) {}
    alert(message);
  }
});
document.querySelector('#system-status-button').addEventListener('click', async () => {
  document.querySelector('#account-menu').hidden = true;
  const body = document.querySelector('#system-status-body');
  body.className = 'loading';
  body.textContent = 'Loading...';
  document.querySelector('#system-status-dialog').showModal();
  const response = await fetch('/api/admin/system');
  if (!response.ok) { body.className = ''; body.textContent = 'Could not load system status.'; return; }
  const status = await response.json();
  const items = [
    ['Environment', status.environment],
    ['Database', `${status.databaseProduct} (${status.databaseStatus})`],
    ['Employees on roster', status.employeeCount],
    ['Shifts stored', status.shiftCount],
    ['Server time', new Date(status.serverTime).toLocaleString()]
  ];
  body.className = 'status-grid';
  body.innerHTML = items.map(([label, value]) => `<div class="status-item"><span class="status-label">${escapeHtml(label)}</span><span class="status-value">${escapeHtml(String(value))}</span></div>`).join('');
});
document.querySelector('#system-status-close').addEventListener('click', () => document.querySelector('#system-status-dialog').close());
document.querySelector('#schedule-body').addEventListener('click', event => {
  if (!state.canManage) {
    const shiftElement = event.target.closest('.shift[data-shift-id]');
    if (shiftElement) { const shift = state.shifts.find(item => String(item.id) === shiftElement.dataset.shiftId); if (shift) openShiftDetail(shift, event.clientX, event.clientY); }
    return;
  }
  if (suppressNextClick) { suppressNextClick = false; return; }
  const shiftElement = event.target.closest('.shift[data-shift-id]');
  if (shiftElement) { const shift = state.shifts.find(item => String(item.id) === shiftElement.dataset.shiftId); if (shift) openShiftMenu({ type: 'shift', shift }, event.clientX, event.clientY); return; }
  const emptyCell = event.target.closest('.shift-cell[data-employee-name]');
  if (emptyCell) { openShiftMenu({ type: 'empty', employeeName: emptyCell.dataset.employeeName, shiftDate: emptyCell.dataset.shiftDate }, event.clientX, event.clientY); return; }
  const nameEl = event.target.closest('.employee-name');
  if (nameEl) openEmployeeDialog(nameEl.dataset.employeeName);
});
document.querySelector('#schedule-body').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (!state.canManage) {
    const shiftElement = event.target.closest('.shift[data-shift-id]');
    if (shiftElement) {
      event.preventDefault();
      const shift = state.shifts.find(item => String(item.id) === shiftElement.dataset.shiftId);
      const rect = shiftElement.getBoundingClientRect();
      if (shift) openShiftDetail(shift, rect.left, rect.bottom);
    }
    return;
  }
  const shiftElement = event.target.closest('.shift[data-shift-id]');
  if (shiftElement) {
    event.preventDefault();
    const shift = state.shifts.find(item => String(item.id) === shiftElement.dataset.shiftId);
    const rect = shiftElement.getBoundingClientRect();
    if (shift) openShiftMenu({ type: 'shift', shift }, rect.left, rect.bottom);
    return;
  }
  const emptyCell = event.target.closest('.shift-cell[data-employee-name]');
  if (emptyCell) {
    event.preventDefault();
    const rect = emptyCell.getBoundingClientRect();
    openShiftMenu({ type: 'empty', employeeName: emptyCell.dataset.employeeName, shiftDate: emptyCell.dataset.shiftDate }, rect.left, rect.bottom);
    return;
  }
  const nameEl = event.target.closest('.employee-name');
  if (nameEl) {
    event.preventDefault();
    openEmployeeDialog(nameEl.dataset.employeeName);
  }
});
function openEmployeeDialog(name) {
  const form = document.querySelector('#employee-form');
  form.reset();
  form.originalName.value = name;
  form.employeeName.value = name;
  const match = state.employees.find(e => e.name === name);
  form.employeeId.value = match && match.employeeId ? match.employeeId : '';
  form.onCall.checked = Boolean(match && match.onCall);
  document.querySelector('#employee-dialog').showModal();
}
document.querySelector('#employee-form .close').addEventListener('click', () => document.querySelector('#employee-dialog').close());
document.querySelector('#employee-form .dialog-actions [value="cancel"]').addEventListener('click', () => document.querySelector('#employee-dialog').close());
document.querySelector('#employee-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const originalName = formData.get('originalName');
  const response = await fetch(`/api/schedule/employees/${encodeURIComponent(originalName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({ employeeName: formData.get('employeeName'), employeeId: formData.get('employeeId') || null, onCall: formData.get('onCall') === 'on' })
  });
  if (response.ok) {
    document.querySelector('#employee-dialog').close();
    await Promise.all([loadWeek(), loadEmployees()]);
  } else {
    let message = 'Could not update employee. Please try again.';
    try { const body = await response.json(); if (body.message) message = body.message; } catch (ignored) {}
    alert(message);
  }
});
document.querySelector('#delete-employee').addEventListener('click', () => {
  const name = document.querySelector('#employee-form').originalName.value;
  if (!name) return;
  document.querySelector('#employee-dialog').close();
  confirmDelete('Delete employee', `Remove ${name} from the schedule? Shifts after today will be deleted, but today's and past shifts are kept.`, async () => {
    const response = await fetch(`/api/schedule/employees/${encodeURIComponent(name)}`, { method: 'DELETE', headers: csrfHeaders() });
    if (response.ok) {
      await Promise.all([loadWeek(), loadEmployees()]);
    } else {
      const errorText = await response.text();
      console.error('Failed to delete employee:', errorText);
      alert('Could not delete employee. Please try again.');
    }
  });
});
document.querySelector('#delete-employee-history').addEventListener('click', () => {
  const name = document.querySelector('#employee-form').originalName.value;
  if (!name) return;
  document.querySelector('#employee-dialog').close();
  confirmDelete('Remove from history', `Are you sure you want to remove ${name} from the entire history? This permanently deletes all of their shifts and cannot be undone.`, async () => {
    const response = await fetch(`/api/schedule/employees/${encodeURIComponent(name)}/history`, { method: 'DELETE', headers: csrfHeaders() });
    if (response.ok) {
      await Promise.all([loadWeek(), loadEmployees()]);
    } else {
      const errorText = await response.text();
      console.error('Failed to remove employee history:', errorText);
      alert('Could not remove employee history. Please try again.');
    }
  });
});
// Manager/admin action menu (Edit/Copy/Add/Paste/Delete), positioned near
// the click/tap. Only ever opened for canManage sessions -- the read-only
// equivalent for view-only sessions is openShiftDetail() further down,
// which shows the full time range but offers no actions.
let menuContext = null;
let copiedShift = null;
let shiftMenuOutsideClickHandler = null;
function openShiftMenu(context, x, y) {
  menuContext = context;
  const isShift = context.type === 'shift';
  document.querySelector('#shift-menu-edit').hidden = !isShift;
  document.querySelector('#shift-menu-copy').hidden = !isShift;
  document.querySelector('#shift-menu-delete').hidden = !isShift;
  document.querySelector('#shift-menu-add').hidden = isShift;
  document.querySelector('#shift-menu-paste').hidden = !copiedShift;
  const menu = document.querySelector('#shift-menu');
  menu.hidden = false;
  const left = Math.min(x, window.innerWidth - menu.offsetWidth - 8);
  const top = Math.min(y, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
  if (shiftMenuOutsideClickHandler) document.removeEventListener('click', shiftMenuOutsideClickHandler);
  shiftMenuOutsideClickHandler = event => {
    if (event.target.closest('#shift-menu')) return;
    closeShiftMenu();
  };
  setTimeout(() => document.addEventListener('click', shiftMenuOutsideClickHandler), 0);
  watchForScrollWhileMenuOpen();
}
function closeShiftMenu() {
  document.querySelector('#shift-menu').hidden = true;
  menuContext = null;
  if (shiftMenuOutsideClickHandler) {
    document.removeEventListener('click', shiftMenuOutsideClickHandler);
    shiftMenuOutsideClickHandler = null;
  }
}
// Read-only popover for view-only (employee) sessions: on narrow screens
// the shift-time text in the grid gets truncated with an ellipsis (see
// .shift-time in styles.css), and employees have no "Edit shift" menu to
// fall back on to see the full range -- this is the only way for them to
// see it. Mirrors openShiftMenu's positioning/outside-click/scroll-dismiss
// behavior but shows plain text instead of action buttons.
let shiftDetailOutsideClickHandler = null;
function openShiftDetail(shift, x, y) {
  const hasTime = shift.startTime && shift.endTime;
  const body = document.querySelector('#shift-detail-body');
  body.textContent = hasTime ? `${regularTime(shift.startTime)} - ${regularTime(shift.endTime)} (${Number(shift.hours).toFixed(2)} hrs)` : 'Time TBD';
  const popover = document.querySelector('#shift-detail-popover');
  popover.hidden = false;
  const left = Math.min(x, window.innerWidth - popover.offsetWidth - 8);
  const top = Math.min(y, window.innerHeight - popover.offsetHeight - 8);
  popover.style.left = `${Math.max(8, left)}px`;
  popover.style.top = `${Math.max(8, top)}px`;
  if (shiftDetailOutsideClickHandler) document.removeEventListener('click', shiftDetailOutsideClickHandler);
  shiftDetailOutsideClickHandler = event => {
    if (event.target.closest('#shift-detail-popover')) return;
    closeShiftDetail();
  };
  setTimeout(() => document.addEventListener('click', shiftDetailOutsideClickHandler), 0);
  watchForScrollWhileDetailOpen();
}
function closeShiftDetail() {
  document.querySelector('#shift-detail-popover').hidden = true;
  if (shiftDetailOutsideClickHandler) {
    document.removeEventListener('click', shiftDetailOutsideClickHandler);
    shiftDetailOutsideClickHandler = null;
  }
}
function watchForScrollWhileDetailOpen() {
  const popover = document.querySelector('#shift-detail-popover');
  const tableWrap = document.querySelector('.table-wrap');
  const startWindowScroll = window.scrollY;
  const startTableScroll = tableWrap ? tableWrap.scrollTop : 0;
  function check() {
    if (popover.hidden) return;
    if (window.scrollY !== startWindowScroll || (tableWrap && tableWrap.scrollTop !== startTableScroll)) {
      closeShiftDetail();
      return;
    }
    requestAnimationFrame(check);
  }
  requestAnimationFrame(check);
}
// Copy/Paste is the touch-friendly alternative to drag-and-drop below (HTML
// mouse events don't fire reliably from touchscreens, so tablet/phone
// managers use Copy on a shift then Paste on the target cell instead of
// dragging). Pasting onto an existing shift updates it in place; pasting
// onto an empty cell creates a new one.
async function pasteCopiedShift(context) {
  if (!copiedShift || !context) return;
  if (context.type === 'shift') {
    const shift = context.shift;
    const response = await fetch(`/api/schedule/${shift.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({
        employeeName: shift.employeeName,
        shiftDate: shift.shiftDate,
        startTime: copiedShift.startTime,
        endTime: copiedShift.endTime,
        lunchMinutes: copiedShift.lunchMinutes,
        shiftType: copiedShift.shiftType,
        onCall: copiedShift.onCall
      })
    });
    if (response.ok) {
      await loadWeek();
    } else {
      const errorText = await response.text();
      console.error('Failed to paste shift:', errorText);
      alert('Could not paste shift. Please try again.');
    }
    return;
  }
  const conflict = state.shifts.some(item => item.employeeName === context.employeeName && item.shiftDate === context.shiftDate);
  if (conflict) { alert(`${context.employeeName} already has a shift on ${context.shiftDate}.`); return; }
  const response = await fetch('/api/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({
      employeeName: context.employeeName,
      shiftDate: context.shiftDate,
      startTime: copiedShift.startTime,
      endTime: copiedShift.endTime,
      lunchMinutes: copiedShift.lunchMinutes,
      shiftType: copiedShift.shiftType,
      onCall: copiedShift.onCall
    })
  });
  if (response.ok) {
    await loadWeek();
  } else {
    const errorText = await response.text();
    console.error('Failed to paste shift:', errorText);
    alert('Could not paste shift. Please try again.');
  }
}
function watchForScrollWhileMenuOpen() {
  const menu = document.querySelector('#shift-menu');
  const tableWrap = document.querySelector('.table-wrap');
  const startWindowScroll = window.scrollY;
  const startTableScroll = tableWrap ? tableWrap.scrollTop : 0;
  function check() {
    if (menu.hidden) return;
    if (window.scrollY !== startWindowScroll || (tableWrap && tableWrap.scrollTop !== startTableScroll)) {
      closeShiftMenu();
      return;
    }
    requestAnimationFrame(check);
  }
  requestAnimationFrame(check);
}
document.querySelector('#shift-menu-edit').addEventListener('click', () => {
  const context = menuContext;
  closeShiftMenu();
  if (context && context.type === 'shift') openEditShift(context.shift);
});
document.querySelector('#shift-menu-copy').addEventListener('click', () => {
  const context = menuContext;
  closeShiftMenu();
  if (!context || context.type !== 'shift') return;
  const shift = context.shift;
  copiedShift = {
    startTime: shift.startTime,
    endTime: shift.endTime,
    lunchMinutes: shift.lunchMinutes,
    shiftType: shift.shiftType,
    onCall: shift.onCall
  };
});
document.querySelector('#shift-menu-add').addEventListener('click', () => {
  const context = menuContext;
  closeShiftMenu();
  if (context && context.type === 'empty') openNewShift(context.employeeName, context.shiftDate);
});
document.querySelector('#shift-menu-paste').addEventListener('click', () => {
  const context = menuContext;
  closeShiftMenu();
  pasteCopiedShift(context);
});
// Shared confirmation dialog for every destructive action (delete shift,
// delete employee, remove employee history). Deliberately a real <dialog>
// rather than the browser's native confirm() -- confirm()/prompt() proved
// unreliable in this app's environment, so all confirmations route through
// this one reusable dialog + pendingDeleteAction callback instead.
let pendingDeleteAction = null;
function confirmDelete(title, message, action) {
  pendingDeleteAction = action;
  document.querySelector('#delete-confirm-title').textContent = title;
  document.querySelector('#delete-confirm-message').textContent = message;
  document.querySelector('#delete-confirm-dialog').showModal();
}
document.querySelector('#shift-menu-delete').addEventListener('click', () => {
  const context = menuContext;
  closeShiftMenu();
  if (!context || context.type !== 'shift') return;
  const shift = context.shift;
  confirmDelete('Delete shift', `Delete ${shift.employeeName}'s shift on ${shift.shiftDate}?`, async () => {
    const response = await fetch(`/api/schedule/${shift.id}`, { method: 'DELETE', headers: csrfHeaders() });
    if (response.ok) {
      await loadWeek();
    } else {
      const errorText = await response.text();
      console.error('Failed to delete shift:', errorText);
      alert('Could not delete shift. Please try again.');
    }
  });
});
document.querySelector('#delete-confirm-ok').addEventListener('click', async () => {
  const action = pendingDeleteAction;
  document.querySelector('#delete-confirm-dialog').close();
  if (action) await action();
});
[document.querySelector('#delete-confirm-cancel'), document.querySelector('#delete-confirm-close')].forEach(button => {
  button.addEventListener('click', () => document.querySelector('#delete-confirm-dialog').close());
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!document.querySelector('#shift-menu').hidden) closeShiftMenu();
  if (!document.querySelector('#shift-detail-popover').hidden) closeShiftDetail();
});
// Custom mouse-based drag-and-drop for moving/duplicating a shift (hold
// Ctrl/Cmd while dragging to duplicate instead of move) -- built on raw
// mousedown/mousemove/mouseup rather than the HTML5 drag-and-drop API for
// more control over the ghost element and drop-target highlighting.
// DRAG_THRESHOLD_PX distinguishes an intentional drag from a plain click
// (a click naturally involves a few pixels of mouse movement between
// mousedown and mouseup); below it, the click handler runs normally to open
// the shift menu instead. suppressNextClick then prevents the click that
// fires right after a completed drag's mouseup from also opening that menu.
const DRAG_THRESHOLD_PX = 4;
let dragState = null;
let suppressNextClick = false;
document.querySelector('#schedule-body').addEventListener('mousedown', event => {
  if (!state.canManage) return;
  if (event.button !== 0) return;
  const shiftElement = event.target.closest('.shift[data-shift-id]');
  if (!shiftElement) return;
  const shift = state.shifts.find(item => String(item.id) === shiftElement.dataset.shiftId);
  if (!shift) return;
  dragState = { shiftId: shiftElement.dataset.shiftId, shift, startX: event.clientX, startY: event.clientY, active: false, ghost: null, hoverCell: null };
  event.preventDefault();
});
document.addEventListener('mousemove', event => {
  if (!dragState) return;
  if (!dragState.active) {
    if (Math.abs(event.clientX - dragState.startX) < DRAG_THRESHOLD_PX && Math.abs(event.clientY - dragState.startY) < DRAG_THRESHOLD_PX) return;
    dragState.active = true;
    const ghost = document.createElement('div');
    ghost.className = 'shift-drag-ghost';
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
    document.body.classList.add('dragging-active');
  }
  dragState.duplicate = event.ctrlKey || event.metaKey;
  dragState.ghost.textContent = `${regularTime(dragState.shift.startTime)} - ${regularTime(dragState.shift.endTime)}${dragState.duplicate ? ' (copy)' : ''}`;
  dragState.ghost.style.left = `${event.clientX}px`;
  dragState.ghost.style.top = `${event.clientY}px`;
  const hovered = document.elementFromPoint(event.clientX, event.clientY);
  const cell = hovered ? hovered.closest('.shift-cell') : null;
  if (cell !== dragState.hoverCell) {
    if (dragState.hoverCell) dragState.hoverCell.classList.remove('drag-over');
    if (cell) cell.classList.add('drag-over');
    dragState.hoverCell = cell;
  }
});
document.addEventListener('mouseup', async () => {
  if (!dragState) return;
  const finished = dragState;
  dragState = null;
  if (finished.ghost) finished.ghost.remove();
  document.body.classList.remove('dragging-active');
  if (finished.hoverCell) finished.hoverCell.classList.remove('drag-over');
  if (!finished.active) return;
  suppressNextClick = true;
  const cell = finished.hoverCell;
  if (!cell) return;
  const shift = finished.shift;
  const duplicate = finished.duplicate;
  const targetDate = cell.dataset.shiftDate;
  const targetEmployee = cell.closest('tr')?.dataset.employeeName;
  if (!targetDate || !targetEmployee) return;
  if (!duplicate && targetEmployee === shift.employeeName && targetDate === shift.shiftDate) return;
  const conflict = state.shifts.some(item => item.employeeName === targetEmployee && item.shiftDate === targetDate && (duplicate || String(item.id) !== finished.shiftId));
  if (conflict) { alert(`${targetEmployee} already has a shift on ${targetDate}.`); return; }
  const response = await fetch(duplicate ? '/api/schedule' : `/api/schedule/${finished.shiftId}`, {
    method: duplicate ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({
      employeeName: targetEmployee,
      shiftDate: targetDate,
      startTime: shift.startTime,
      endTime: shift.endTime,
      lunchMinutes: shift.lunchMinutes,
      shiftType: shift.shiftType,
      onCall: shift.onCall
    })
  });
  if (response.ok) {
    await loadWeek();
  } else {
    const errorText = await response.text();
    console.error(`Failed to ${duplicate ? 'duplicate' : 'move'} shift:`, errorText);
    alert(`Could not ${duplicate ? 'duplicate' : 'move'} shift. Please try again.`);
  }
});
document.querySelector('#shift-form').startTime.addEventListener('input', updateCalculatedHours);
document.querySelector('#shift-form').endTime.addEventListener('input', updateCalculatedHours);
document.querySelector('#shift-form').lunchMinutes.addEventListener('change', updateCalculatedHours);
document.querySelector('#shift-form .close').addEventListener('click', () => document.querySelector('#shift-dialog').close());
document.querySelector('#shift-form .dialog-actions [value="cancel"]').addEventListener('click', () => document.querySelector('#shift-dialog').close());
document.querySelector('#shift-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.target; const formData = new FormData(form); const shiftId = formData.get('shiftId'); const response = await fetch(shiftId ? `/api/schedule/${shiftId}` : '/api/schedule', { method: shiftId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ employeeName: formData.get('employeeName'), shiftDate: formData.get('shiftDate'), startTime: formData.get('startTime'), endTime: formData.get('endTime'), lunchMinutes: Number(formData.get('lunchMinutes') || 0), shiftType: formData.get('shiftType'), onCall: formData.get('onCall') === 'on' }) }); if (response.ok) { document.querySelector('#shift-dialog').close(); form.reset(); form.shiftId.value = ''; document.querySelector('#dialog-title').textContent = 'Add employee shift'; updateCalculatedHours(); await loadWeek(); } else { const errorText = await response.text(); console.error('Failed to save shift:', errorText); alert('Could not save shift. Please check the form values and try again.'); } });
// A credentials change invalidates the current session's assumptions (new
// username/password), so force a real re-login afterward rather than trying
// to keep the session alive -- simpler and avoids any risk of a stale
// session outliving the old credentials.
async function logoutAfterCredentialsChange() {
  await fetch('/logout', { method: 'POST', headers: csrfHeaders() });
  window.location.href = '/login.html?credentialsUpdated=1';
}
document.querySelector('#account-settings-button').addEventListener('click', () => {
  document.querySelector('#credentials-form').reset();
  document.querySelector('#credentials-dialog').showModal();
});
document.querySelector('#credentials-form .close').addEventListener('click', () => document.querySelector('#credentials-dialog').close());
document.querySelector('#credentials-form .dialog-actions [value="cancel"]').addEventListener('click', () => document.querySelector('#credentials-dialog').close());
document.querySelector('#credentials-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const newPassword = formData.get('newPassword');
  if (newPassword !== formData.get('confirmPassword')) { alert('New password and confirmation do not match.'); return; }
  const response = await fetch('/api/account/credentials', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({ currentPassword: formData.get('currentPassword'), newUsername: formData.get('newUsername'), newPassword })
  });
  if (response.ok) {
    alert('Login updated. Please sign in again with your new credentials.');
    await logoutAfterCredentialsChange();
  } else {
    let message = 'Could not update credentials. Please check the form values and try again.';
    try { const body = await response.json(); if (body.message) message = body.message; } catch (ignored) {}
    alert(message);
  }
});
bootstrap();
