const state = { weekStart: monday(new Date()), shifts: [], employees: [], role: 'EMPLOYEE' };
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function monday(date) { const result = new Date(date); const day = result.getDay(); result.setDate(result.getDate() - (day === 0 ? 6 : day - 1)); result.setHours(0, 0, 0, 0); return result; }
function iso(date) { return date.toISOString().slice(0, 10); }
function displayDate(date) { return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function csrfHeaders() {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? { 'X-XSRF-TOKEN': decodeURIComponent(match[1]) } : {};
}
async function logout() {
  await fetch('/logout', { method: 'POST', headers: csrfHeaders() });
  window.location.href = '/login.html?logout';
}
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
  document.querySelector('#calculated-hours').value = hours === null ? 'Enter start and end time' : `${hours.toFixed(2)} hours`;
}
function renderHead() { document.querySelector('#schedule-head').innerHTML = `<tr><th>Employee</th>${days.map((day, index) => { const date = new Date(state.weekStart); date.setDate(date.getDate() + index); return `<th><span class="day-name">${day}</span><span class="day-date">${displayDate(date)}</span></th>`; }).join('')}<th>Total</th></tr>`; }
function render() {
  renderHead();
  const rosterNames = state.employees.map(employee => employee.name);
  const shiftNames = state.shifts.map(shift => shift.employeeName);
  const employees = [...new Set([...rosterNames, ...shiftNames])].sort();
  const body = document.querySelector('#schedule-body');
  body.innerHTML = employees.length ? employees.map(name => {
    const employeeShifts = state.shifts.filter(shift => shift.employeeName === name);
    const total = employeeShifts.reduce((sum, shift) => sum + Number(shift.hours), 0);
    const rosterMatch = state.employees.find(employee => employee.name === name);
    const onCall = rosterMatch ? rosterMatch.onCall : employeeShifts.some(shift => shift.onCall);
    const cells = days.map((_, index) => {
      const date = new Date(state.weekStart); date.setDate(date.getDate() + index);
      const dateIso = iso(date);
      const shift = employeeShifts.find(item => item.shiftDate === dateIso);
      const emptyAttrs = shift ? '' : ` data-employee-name="${escapeHtml(name)}" role="button" tabindex="0"`;
      return `<td class="shift-cell" data-shift-date="${dateIso}"${emptyAttrs}>${shift ? `<div class="shift ${shift.shiftType}" data-shift-id="${shift.id}" role="button" tabindex="0"><span class="shift-time">${regularTime(shift.startTime)} - ${regularTime(shift.endTime)}</span><span class="shift-hours">${Number(shift.hours).toFixed(2)} hrs</span></div>` : ''}</td>`;
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
  if (state.role === 'MANAGER') await loadEmployees();
  render();
}
async function loadEmployees() { const response = await fetch('/api/employees'); state.employees = response.ok ? await response.json() : []; }
async function loadRole() {
  const response = await fetch('/api/account/me');
  const body = response.ok ? await response.json() : { role: 'EMPLOYEE' };
  state.role = body.role;
  if (state.role !== 'MANAGER') document.body.classList.add('view-only');
}
async function bootstrap() {
  await loadRole();
  await loadWeek();
}
document.querySelector('#budget').addEventListener('input', render);
document.querySelector('#previous-week').addEventListener('click', () => { state.weekStart.setDate(state.weekStart.getDate() - 7); loadWeek(); });
document.querySelector('#next-week').addEventListener('click', () => { state.weekStart.setDate(state.weekStart.getDate() + 7); loadWeek(); });
function openNewShift(employeeName = '', shiftDate = '') { const form = document.querySelector('#shift-form'); form.reset(); form.shiftId.value = ''; form.employeeName.value = employeeName; form.shiftDate.value = shiftDate; document.querySelector('#dialog-title').textContent = 'Add employee shift'; updateCalculatedHours(); document.querySelector('#shift-dialog').showModal(); }
function openEditShift(shift) { const form = document.querySelector('#shift-form'); form.shiftId.value = shift.id; form.employeeName.value = shift.employeeName; form.shiftDate.value = shift.shiftDate; form.startTime.value = to24HourTime(shift.startTime); form.endTime.value = to24HourTime(shift.endTime); form.lunchMinutes.value = String(shift.lunchMinutes || 0); form.shiftType.value = shift.shiftType; document.querySelector('#dialog-title').textContent = 'Edit employee shift'; updateCalculatedHours(); document.querySelector('#shift-dialog').showModal(); }
document.querySelector('#open-shift').addEventListener('click', () => openNewShift());
document.querySelector('#download-schedule').addEventListener('click', () => window.print());
document.querySelector('#logout-button').addEventListener('click', logout);
document.querySelector('#schedule-body').addEventListener('click', event => {
  if (state.role !== 'MANAGER') return;
  if (suppressNextClick) { suppressNextClick = false; return; }
  const shiftElement = event.target.closest('.shift[data-shift-id]');
  if (shiftElement) { const shift = state.shifts.find(item => String(item.id) === shiftElement.dataset.shiftId); if (shift) openShiftMenu({ type: 'shift', shift }, event.clientX, event.clientY); return; }
  const emptyCell = event.target.closest('.shift-cell[data-employee-name]');
  if (emptyCell) { openShiftMenu({ type: 'empty', employeeName: emptyCell.dataset.employeeName, shiftDate: emptyCell.dataset.shiftDate }, event.clientX, event.clientY); return; }
  const nameEl = event.target.closest('.employee-name');
  if (nameEl) openEmployeeDialog(nameEl.dataset.employeeName);
});
document.querySelector('#schedule-body').addEventListener('keydown', event => {
  if (state.role !== 'MANAGER') return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
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
        shiftType: copiedShift.shiftType
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
      shiftType: copiedShift.shiftType
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
    shiftType: shift.shiftType
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
let shiftPendingDelete = null;
document.querySelector('#shift-menu-delete').addEventListener('click', () => {
  const context = menuContext;
  closeShiftMenu();
  if (!context || context.type !== 'shift') return;
  const shift = context.shift;
  shiftPendingDelete = shift;
  document.querySelector('#delete-confirm-message').textContent =
    `Delete ${shift.employeeName}'s shift on ${shift.shiftDate}?`;
  document.querySelector('#delete-confirm-dialog').showModal();
});
document.querySelector('#delete-confirm-ok').addEventListener('click', async () => {
  const shift = shiftPendingDelete;
  document.querySelector('#delete-confirm-dialog').close();
  if (!shift) return;
  const response = await fetch(`/api/schedule/${shift.id}`, { method: 'DELETE', headers: csrfHeaders() });
  if (response.ok) {
    await loadWeek();
  } else {
    const errorText = await response.text();
    console.error('Failed to delete shift:', errorText);
    alert('Could not delete shift. Please try again.');
  }
});
[document.querySelector('#delete-confirm-cancel'), document.querySelector('#delete-confirm-close')].forEach(button => {
  button.addEventListener('click', () => document.querySelector('#delete-confirm-dialog').close());
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.querySelector('#shift-menu').hidden) closeShiftMenu();
});
const DRAG_THRESHOLD_PX = 4;
let dragState = null;
let suppressNextClick = false;
document.querySelector('#schedule-body').addEventListener('mousedown', event => {
  if (state.role !== 'MANAGER') return;
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
      shiftType: shift.shiftType
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
document.querySelector('#shift-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.target; const formData = new FormData(form); const shiftId = formData.get('shiftId'); const response = await fetch(shiftId ? `/api/schedule/${shiftId}` : '/api/schedule', { method: shiftId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ employeeName: formData.get('employeeName'), shiftDate: formData.get('shiftDate'), startTime: formData.get('startTime'), endTime: formData.get('endTime'), lunchMinutes: Number(formData.get('lunchMinutes') || 0), shiftType: formData.get('shiftType') }) }); if (response.ok) { document.querySelector('#shift-dialog').close(); form.reset(); form.shiftId.value = ''; document.querySelector('#dialog-title').textContent = 'Add employee shift'; updateCalculatedHours(); await loadWeek(); } else { const errorText = await response.text(); console.error('Failed to save shift:', errorText); alert('Could not save shift. Please check the form values and try again.'); } });
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
