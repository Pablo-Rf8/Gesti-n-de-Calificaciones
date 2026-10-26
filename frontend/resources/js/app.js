const $ = (id) => document.getElementById(id);
const state = { csrf: '', user: null, tab: 'students', page: 1, lastPage: 1, filters: {}, rows: [], editing: null, request: 0 };
let confirmAction;
let studentSearchVersion = 0;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': state.csrf, ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if ((response.status === 401 || response.status === 419) && state.user) {
      showLogin('Tu sesión venció. Ingresá nuevamente para continuar.');
      await refreshCsrf();
    }
    const details = body.errors ? Object.values(body.errors).flat().join(' ') : null;
    const defaults = { 401: 'Iniciá sesión para continuar.', 419: 'La sesión cambió. Recargá la página e intentá nuevamente.', 429: 'Hay muchas solicitudes. Esperá un minuto e intentá de nuevo.' };
    throw new Error(details || defaults[response.status] || (response.status < 500 ? body.message : null) || 'No se pudo completar la solicitud. Intentá de nuevo.');
  }
  if (options.download) return response.blob();
  return response.status === 204 ? null : response.json();
}

async function refreshCsrf() {
  const data = await api('/auth/csrf');
  state.csrf = data.csrf_token;
}

function showLogin(message = '') {
  state.user = null;
  state.rows = [];
  state.request++;
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
  $('table-body').replaceChildren();
  $('workspace').hidden = true;
  $('login-panel').hidden = false;
  $('starting').hidden = true;
  $('login-error').textContent = message;
  $('password').value = '';
  $('password').type = 'password';
  $('show-password').textContent = 'Mostrar';
  $('show-password').setAttribute('aria-pressed', 'false');
}

function showWorkspace(user) {
  state.user = user;
  $('login-panel').hidden = true;
  $('workspace').hidden = false;
  $('starting').hidden = true;
  $('signed-in').textContent = user.name;
  $('password').value = '';
  $('notice').textContent = '';
  switchTab('students');
}

async function busy(button, label, work) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try { return await work(); }
  finally { button.disabled = false; button.textContent = original; }
}

$('show-password').addEventListener('click', () => {
  const visible = $('password').type === 'password';
  $('password').type = visible ? 'text' : 'password';
  $('show-password').textContent = visible ? 'Ocultar' : 'Mostrar';
  $('show-password').setAttribute('aria-pressed', String(visible));
});

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('login-error').textContent = '';
  try {
    await busy(event.submitter, 'Ingresando…', async () => {
      await refreshCsrf();
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
      state.csrf = result.csrf_token;
      showWorkspace(result.user);
    });
  } catch (error) { $('login-error').textContent = error.message; }
});

function confirm(title, description, label, action) {
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = description;
  $('confirm-action').textContent = label;
  $('confirm-error').textContent = '';
  confirmAction = action;
  $('confirm-dialog').showModal();
  $('confirm-dialog').querySelector('[data-close]').focus();
}

$('confirm-action').addEventListener('click', async (event) => {
  try {
    await busy(event.target, 'Procesando…', confirmAction);
    $('confirm-dialog').close();
  } catch (error) { $('confirm-error').textContent = error.message; }
});
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
$('logout').addEventListener('click', () => confirm('Cerrar sesión', '¿Querés salir de tu cuenta?', 'Cerrar sesión', async () => {
  const result = await api('/auth/logout', { method: 'POST' });
  state.csrf = result.csrf_token;
  showLogin();
}));

function switchTab(tab) {
  state.tab = tab;
  state.page = 1;
  state.filters = {};
  $('filters').reset();
  $('notice').textContent = '';
  const students = tab === 'students';
  $('list-title').textContent = students ? 'Alumnos' : 'Calificaciones';
  $('list-help').textContent = students ? 'Registrá alumnos para asignarles calificaciones.' : 'Notas de 0 a 100. El Excel incluye todos los resultados de los filtros aplicados.';
  $('new-record').textContent = students ? 'Agregar alumno' : 'Registrar calificación';
  $('export').hidden = students;
  document.querySelectorAll('.grade-filter').forEach((element) => { element.hidden = students; });
  for (const name of ['students', 'grades']) {
    if (name === tab) $(`tab-${name}`).setAttribute('aria-current', 'page');
    else $(`tab-${name}`).removeAttribute('aria-current');
  }
  loadRecords();
}
$('tab-students').addEventListener('click', () => switchTab('students'));
$('tab-grades').addEventListener('click', () => switchTab('grades'));

function queryString() { return new URLSearchParams(state.filters).toString(); }
async function loadRecords() {
  const version = ++state.request;
  $('records').hidden = true;
  $('pagination').hidden = true;
  $('retry').hidden = true;
  $('list-error').textContent = '';
  $('list-status').textContent = state.tab === 'students' ? 'Cargando alumnos…' : 'Cargando calificaciones…';
  try {
    const result = await api(`/${state.tab}?${queryString()}&page=${state.page}`);
    if (version !== state.request) return;
    state.lastPage = result.last_page;
    if (state.page > state.lastPage) { state.page = state.lastPage; return loadRecords(); }
    state.rows = result.data;
    if (!result.total) {
      const filtered = Object.values(state.filters).some(Boolean);
      $('list-status').textContent = filtered ? 'No hay resultados con estos filtros. Cambiá la búsqueda o presioná Limpiar.' : state.tab === 'students' ? 'Todavía no hay alumnos. Presioná Agregar alumno para registrar el primero.' : 'Todavía no hay calificaciones. Registrá un alumno y luego agregá su nota.';
      return;
    }
    $('list-status').textContent = `${result.from} a ${result.to} de ${result.total} registros`;
    renderRows();
    $('records').hidden = false;
    $('pagination').hidden = false;
    $('page-label').textContent = `Página ${state.page} de ${state.lastPage}`;
    $('previous').disabled = state.page <= 1;
    $('next').disabled = state.page >= state.lastPage;
  } catch (error) {
    if (version !== state.request) return;
    $('list-status').textContent = '';
    $('list-error').textContent = error.message;
    $('retry').hidden = false;
  }
}

function renderRows() {
  const students = state.tab === 'students';
  const headers = students ? ['Matrícula', 'Alumno', 'Notas', 'Acciones'] : ['Alumno', 'Asignatura', 'Período', 'Nota / 100', 'Captura', 'Acciones'];
  $('table-caption').textContent = students ? 'Alumnos registrados' : 'Calificaciones registradas';
  $('table-head').replaceChildren(...headers.map((label) => {
    const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; return cell;
  }));
  $('table-body').replaceChildren(...state.rows.map((record) => {
    const row = document.createElement('tr');
    const values = students ? [record.registration_number, record.name, record.grades_count] : [record.student.name, record.subject, record.period, Number(record.score).toFixed(2), new Date(record.created_at).toLocaleDateString('es-GT')];
    values.forEach((value, index) => {
      const cell = document.createElement('td'); cell.dataset.label = headers[index]; cell.textContent = value;
      if (!students && index === 3) cell.className = 'score';
      row.append(cell);
    });
    const cell = document.createElement('td'); cell.dataset.label = 'Acciones';
    const actions = document.createElement('div'); actions.className = 'actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Editar';
    edit.addEventListener('click', () => openEditor(record));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Eliminar';
    remove.addEventListener('click', () => confirm(students ? 'Eliminar alumno' : 'Eliminar calificación', students ? `Se eliminará a ${record.name}. Si tiene notas, primero tendrás que eliminarlas.` : `Se eliminará la nota de ${record.student.name} en ${record.subject}, ${record.period}. Esta acción no se puede deshacer.`, 'Eliminar', async () => {
      await api(`/${state.tab}/${record.id}`, { method: 'DELETE' });
      $('notice').textContent = 'Registro eliminado.';
      await loadRecords();
    }));
    actions.append(edit, remove); cell.append(actions); row.append(cell); return row;
  }));
}

$('filters').addEventListener('submit', (event) => {
  event.preventDefault();
  state.filters = { q: $('search').value.trim() };
  if (state.tab === 'grades') Object.assign(state.filters, { subject: $('filter-subject').value.trim(), period: $('filter-period').value.trim() });
  state.page = 1; loadRecords();
});
$('clear-filters').addEventListener('click', () => { $('filters').reset(); state.filters = {}; state.page = 1; loadRecords(); });
$('previous').addEventListener('click', () => { if (state.page > 1) { state.page--; loadRecords(); } });
$('next').addEventListener('click', () => { if (state.page < state.lastPage) { state.page++; loadRecords(); } });
$('retry').addEventListener('click', loadRecords);

function openEditor(record = null) {
  state.editing = record;
  if (state.tab === 'students') {
    $('student-form').reset();
    $('student-title').textContent = record ? 'Editar alumno' : 'Agregar alumno';
    $('student-name').value = record?.name ?? '';
    $('student-registration').value = record?.registration_number ?? '';
    $('student-error').textContent = '';
    $('student-dialog').showModal();
  } else {
    $('grade-form').reset(); $('student-search-form').reset();
    $('grade-title').textContent = record ? 'Editar calificación' : 'Registrar calificación';
    $('grade-subject').value = record?.subject ?? '';
    $('grade-period').value = record?.period ?? '';
    $('grade-score').value = record?.score ?? '';
    $('grade-error').textContent = '';
    $('grade-student').replaceChildren(new Option('Seleccioná un alumno', ''));
    $('grade-dialog').showModal();
    loadStudentOptions(record?.student);
  }
}
$('new-record').addEventListener('click', () => openEditor());

async function loadStudentOptions(selected = null) {
  const version = ++studentSearchVersion;
  $('student-search-status').textContent = 'Buscando alumnos…';
  $('grade-student').disabled = true;
  try {
    const result = await api(`/students?q=${encodeURIComponent($('student-search').value.trim())}`);
    if (version !== studentSearchVersion) return;
    const students = [...result.data];
    if (selected && !students.some((student) => student.id === selected.id)) students.unshift(selected);
    $('grade-student').replaceChildren(new Option('Seleccioná un alumno', ''), ...students.map((student) => new Option(`${student.registration_number} · ${student.name}`, student.id)));
    if (selected) $('grade-student').value = selected.id;
    $('student-search-status').textContent = result.total ? `Se muestran hasta 10 alumnos. Buscá por matrícula si no encontrás al alumno.` : 'No se encontraron alumnos. Probá otra búsqueda o agregá uno en Alumnos.';
  } catch (error) { $('student-search-status').textContent = error.message; }
  finally { if (version === studentSearchVersion) $('grade-student').disabled = false; }
}
$('student-search-form').addEventListener('submit', (event) => { event.preventDefault(); loadStudentOptions(); });

for (const kind of ['student', 'grade']) {
  $(`${kind}-form`).addEventListener('submit', async (event) => {
    event.preventDefault();
    $(`${kind}-error`).textContent = '';
    const editing = state.editing;
    const data = Object.fromEntries(new FormData(event.target));
    if (kind === 'grade' && $('grade-student').disabled) { $(`${kind}-error`).textContent = 'Esperá a que termine la búsqueda de alumnos.'; return; }
    try {
      await busy(event.submitter, 'Guardando…', async () => {
        await api(`/${kind}s${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(data) });
        $(`${kind}-dialog`).close();
        $('notice').textContent = kind === 'student' ? 'Alumno guardado.' : 'Calificación guardada.';
        await loadRecords();
      });
    } catch (error) { $(`${kind}-error`).textContent = error.message; }
  });
}

$('export').addEventListener('click', async (event) => {
  $('list-error').textContent = '';
  try {
    await busy(event.target, 'Preparando Excel…', async () => {
      const blob = await api(`/grades/export/excel?${queryString()}`, { download: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'calificaciones.xlsx';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('notice').textContent = 'Excel descargado con todos los resultados de los filtros aplicados.';
    });
  } catch (error) { $('list-error').textContent = error.message; }
});

async function start() {
  try {
    await refreshCsrf();
    const response = await fetch('/auth/me', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (response.status === 401) { showLogin(); return; }
    if (!response.ok) throw new Error('No se pudo comprobar la sesión. Recargá la página para intentar de nuevo.');
    showWorkspace((await response.json()).user);
  } catch (error) { showLogin(error.message); }
}
start();
