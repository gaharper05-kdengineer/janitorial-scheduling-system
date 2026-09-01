const state = { weekStart: monday(new Date()), shifts: [] };
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
  const employees = [...new Set(state.shifts.map(shift => shift.employeeName))].sort();
  const body = document.querySelector('#schedule-body');
  body.innerHTML = employees.length ? employees.map(name => {
    const employeeShifts = state.shifts.filter(shift => shift.employeeName === name);
    const total = employeeShifts.reduce((sum, shift) => sum + Number(shift.hours), 0);
    const cells = days.map((_, index) => {
      const date = new Date(state.weekStart); date.setDate(date.getDate() + index);
      const dateIso = iso(date);
      const shift = employeeShifts.find(item => item.shiftDate === dateIso);
      const emptyAttrs = shift ? '' : ` data-employee-name="${escapeHtml(name)}" role="button" tabindex="0"`;
      return `<td class="shift-cell" data-shift-date="${dateIso}"${emptyAttrs}>${shift ? `<div class="shift ${shift.shiftType}" data-shift-id="${shift.id}" role="button" tabindex="0"><span class="shift-time">${regularTime(shift.startTime)} - ${regularTime(shift.endTime)}</span><span class="shift-hours">${Number(shift.hours).toFixed(2)} hrs</span></div>` : ''}</td>`;
    }).join('');
    return `<tr data-employee-name="${escapeHtml(name)}"><td class="employee"><span class="employee-name" data-employee-name="${escapeHtml(name)}">${escapeHtml(name)}</span></td>${cells}<td class="total">${total.toFixed(2)}</td></tr>`;
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
async function loadWeek() { const response = await fetch('/api/schedule'); state.shifts = response.ok ? await response.json() : []; render(); }
document.querySelector('#budget').addEventListener('input', render);
document.querySelector('#previous-week').addEventListener('click', () => { state.weekStart.setDate(state.weekStart.getDate() - 7); render(); });
document.querySelector('#next-week').addEventListener('click', () => { state.weekStart.setDate(state.weekStart.getDate() + 7); render(); });
function openNewShift(employeeName = '', shiftDate = '') { const form = document.querySelector('#shift-form'); form.reset(); form.shiftId.value = ''; form.employeeName.value = employeeName; form.shiftDate.value = shiftDate; document.querySelector('#dialog-title').textContent = 'Add employee shift'; updateCalculatedHours(); document.querySelector('#shift-dialog').showModal(); }
function openEditShift(shift) { const form = document.querySelector('#shift-form'); form.shiftId.value = shift.id; form.employeeName.value = shift.employeeName; form.shiftDate.value = shift.shiftDate; form.startTime.value = to24HourTime(shift.startTime); form.endTime.value = to24HourTime(shift.endTime); form.lunchMinutes.value = String(shift.lunchMinutes || 0); form.shiftType.value = shift.shiftType; document.querySelector('#dialog-title').textContent = 'Edit employee shift'; updateCalculatedHours(); document.querySelector('#shift-dialog').showModal(); }
document.querySelector('#open-shift').addEventListener('click', () => openNewShift());
document.querySelector('#logout-button').addEventListener('click', logout);
document.querySelector('#schedule-body').addEventListener('click', event => {
  if (suppressNextClick) { suppressNextClick = false; return; }
  const shiftElement = event.target.closest('.shift[data-shift-id]');
  if (shiftElement) { const shift = state.shifts.find(item => String(item.id) === shiftElement.dataset.shiftId); if (shift) openEditShift(shift); return; }
  const emptyCell = event.target.closest('.shift-cell[data-employee-name]');
  if (emptyCell) { openNewShift(emptyCell.dataset.employeeName, emptyCell.dataset.shiftDate); return; }
  const nameEl = event.target.closest('.employee-name');
  if (nameEl && !nameEl.querySelector('input')) startEditingEmployeeName(nameEl);
});
document.querySelector('#schedule-body').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const shiftElement = event.target.closest('.shift[data-shift-id]');
  if (shiftElement) {
    event.preventDefault();
    const shift = state.shifts.find(item => String(item.id) === shiftElement.dataset.shiftId);
    if (shift) openEditShift(shift);
    return;
  }
  const emptyCell = event.target.closest('.shift-cell[data-employee-name]');
  if (emptyCell) {
    event.preventDefault();
    openNewShift(emptyCell.dataset.employeeName, emptyCell.dataset.shiftDate);
  }
});
function startEditingEmployeeName(nameEl) {
  const originalName = nameEl.dataset.employeeName;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'employee-name-input';
  input.value = originalName;
  nameEl.replaceChildren(input);
  input.focus();
  input.select();
  let settled = false;
  const cancel = () => { if (settled) return; settled = true; render(); };
  const commit = async () => {
    if (settled) return;
    settled = true;
    const newName = input.value.trim();
    if (!newName || newName === originalName) { render(); return; }
    const response = await fetch(`/api/schedule/employees/${encodeURIComponent(originalName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ employeeName: newName })
    });
    if (response.ok) {
      await loadWeek();
    } else {
      const errorText = await response.text();
      console.error('Failed to rename employee:', errorText);
      alert('Could not rename employee. Please try again.');
      render();
    }
  };
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); commit(); }
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', () => commit());
}
const DRAG_THRESHOLD_PX = 4;
let dragState = null;
let suppressNextClick = false;
document.querySelector('#schedule-body').addEventListener('mousedown', event => {
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
    ghost.textContent = `${regularTime(dragState.shift.startTime)} - ${regularTime(dragState.shift.endTime)}`;
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
    document.body.classList.add('dragging-active');
  }
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
  const targetDate = cell.dataset.shiftDate;
  const targetEmployee = cell.closest('tr')?.dataset.employeeName;
  if (!targetDate || targetEmployee !== shift.employeeName || targetDate === shift.shiftDate) return;
  const conflict = state.shifts.some(item => item.employeeName === shift.employeeName && item.shiftDate === targetDate && String(item.id) !== finished.shiftId);
  if (conflict) { alert(`${shift.employeeName} already has a shift on ${targetDate}.`); return; }
  const response = await fetch(`/api/schedule/${finished.shiftId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({
      employeeName: shift.employeeName,
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
    console.error('Failed to move shift:', errorText);
    alert('Could not move shift. Please try again.');
  }
});
document.querySelector('#shift-form').startTime.addEventListener('input', updateCalculatedHours);
document.querySelector('#shift-form').endTime.addEventListener('input', updateCalculatedHours);
document.querySelector('#shift-form').lunchMinutes.addEventListener('change', updateCalculatedHours);
document.querySelector('#shift-form .close').addEventListener('click', () => document.querySelector('#shift-dialog').close());
document.querySelector('#shift-form [value="cancel"]').addEventListener('click', () => document.querySelector('#shift-dialog').close());
document.querySelector('#shift-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.target; const formData = new FormData(form); const shiftId = formData.get('shiftId'); const response = await fetch(shiftId ? `/api/schedule/${shiftId}` : '/api/schedule', { method: shiftId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ employeeName: formData.get('employeeName'), shiftDate: formData.get('shiftDate'), startTime: formData.get('startTime'), endTime: formData.get('endTime'), lunchMinutes: Number(formData.get('lunchMinutes') || 0), shiftType: formData.get('shiftType') }) }); if (response.ok) { document.querySelector('#shift-dialog').close(); form.reset(); form.shiftId.value = ''; document.querySelector('#dialog-title').textContent = 'Add employee shift'; updateCalculatedHours(); await loadWeek(); } else { const errorText = await response.text(); console.error('Failed to save shift:', errorText); alert('Could not save shift. Please check the form values and try again.'); } });
loadWeek();
