const $ = (id) => document.getElementById(id);
const state = { csrf: '', user: null, tab: 'students', page: 1, lastPage: 1, filters: {}, rows: [], editing: null, request: 0 };
const currentYear = new Date().getFullYear();
$('current-cycle').textContent = `Ciclo ${currentYear}`;
let confirmAction;
let studentSearchVersion = 0;
let studentSearchTimer;
let exportFilters;

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
  if (options.download) {
    const disposition = response.headers.get('Content-Disposition') || '';
    const encodedName = disposition.match(/filename\*=utf-8''([^;]+)/i);
    const plainName = disposition.match(/filename="([^"]+)"|filename=([^;]+)/i);
    const filename = encodedName ? decodeURIComponent(encodedName[1]) : plainName?.[1] || plainName?.[2] || 'Calificaciones generales.xlsx';
    return { blob: await response.blob(), filename };
  }
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

function switchTab(tab, filters = null) {
  state.tab = tab;
  state.page = 1;
  state.filters = filters || (tab === 'students' ? {} : { academic_year: currentYear });
  $('filters').reset();
  $('notice').textContent = '';
  const students = tab === 'students';
  const summary = tab === 'summary';
  $('list-title').textContent = students ? 'Alumnos' : summary ? 'Resumen anual' : 'Calificaciones por bimestre';
  $('list-help').textContent = students ? 'Cada alumno tiene su matrícula y su registro de notas.' : summary ? 'Los cuatro bimestres de cada asignatura, con su promedio y resultado.' : 'Registrá o corregí la nota de cada alumno. Escala de 0 a 100.';
  $('new-record').textContent = students ? 'Agregar alumno' : 'Registrar calificación';
  $('export').hidden = students;
  document.querySelectorAll('.grade-filter').forEach((element) => { element.hidden = students; });
  $('period-filter').hidden = students || summary;
  $('annual-rule').hidden = !summary;
  $('filters').classList.toggle('students-filters', students);
  $('records').classList.toggle('summary-table', summary);
  $('filter-year').disabled = students;
  $('filter-year').value = state.filters.academic_year || currentYear;
  $('search').value = state.filters.q || '';
  $('filter-subject').value = state.filters.subject || '';
  $('filter-period').value = state.filters.period || '';
  $('filter-section').value = state.filters.section || '';
  for (const name of ['students', 'grades', 'summary']) {
    if (name === tab) $(`tab-${name}`).setAttribute('aria-current', 'page');
    else $(`tab-${name}`).removeAttribute('aria-current');
  }
  loadRecords();
}
$('tab-students').addEventListener('click', () => switchTab('students'));
$('tab-grades').addEventListener('click', () => switchTab('grades'));
$('tab-summary').addEventListener('click', () => switchTab('summary'));

function queryString() { return new URLSearchParams(state.filters).toString(); }
async function loadRecords() {
  const version = ++state.request;
  $('records').hidden = true;
  $('pagination').hidden = true;
  $('retry').hidden = true;
  $('demo-note').hidden = true;
  $('list-error').textContent = '';
  $('list-status').textContent = state.tab === 'students' ? 'Cargando alumnos…' : 'Cargando calificaciones…';
  try {
    const endpoint = state.tab === 'summary' ? '/grades/summary' : `/${state.tab}`;
    const result = await api(`${endpoint}?${queryString()}&page=${state.page}`);
    if (version !== state.request) return;
    state.lastPage = result.last_page;
    if (state.page > state.lastPage) { state.page = state.lastPage; return loadRecords(); }
    state.rows = result.data;
    $('demo-note').hidden = !state.rows.some((row) => (state.tab === 'students' ? row : row.student).is_demo);
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
  const summary = state.tab === 'summary';
  const headers = students ? ['Matrícula', 'Alumno', 'Sección', 'Notas', 'Acciones'] : summary ? ['Alumno', 'Asignatura', 'Bim. 1', 'Bim. 2', 'Bim. 3', 'Bim. 4', 'Promedio', 'Resultado', 'Acciones'] : ['Alumno', 'Asignatura', 'Bimestre', 'Nota / 100', 'Captura', 'Acciones'];
  $('table-caption').textContent = students ? 'Alumnos registrados' : summary ? 'Promedio y resultado anual por asignatura' : 'Calificaciones registradas';
  $('table-head').replaceChildren(...headers.map((label) => {
    const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; return cell;
  }));
  $('table-body').replaceChildren(...state.rows.map((record) => {
    const row = document.createElement('tr');
    const values = students ? [record.registration_number, record.name, record.section, record.grades_count] : summary ? [record.student.name, record.subject, ...record.terms.map(formatScore), formatScore(record.average), record.status] : [record.student.name, record.subject, record.period, formatScore(record.score), new Date(record.created_at).toLocaleDateString('es-GT')];
    values.forEach((value, index) => {
      const cell = document.createElement('td'); cell.dataset.label = headers[index]; cell.textContent = value;
      if (!students && (summary ? index >= 2 && index <= 6 : index === 3)) cell.className = 'score';
      if ((students && index === 1) || (!students && index === 0)) {
        const student = students ? record : record.student;
        const name = document.createElement('span'); name.className = 'student-name'; name.textContent = student.name;
        cell.replaceChildren(name);
        const detail = document.createElement('small');
        detail.textContent = [!students ? student.registration_number : '', !students ? `Sección ${student.section}` : '', student.is_demo ? 'Prueba' : ''].filter(Boolean).join(' · ');
        if (detail.textContent) cell.append(detail);
      }
      if (!students && index === 1) {
        const cycle = document.createElement('small'); cycle.textContent = `Ciclo ${record.academic_year}`; cell.append(cycle);
      }
      if (summary && index === 7) {
        const result = document.createElement('span'); result.textContent = record.status;
        result.className = `result result-${record.status === 'Aprobado' ? 'approved' : record.status === 'Reprobado' ? 'failed' : 'pending'}`;
        cell.replaceChildren(result);
        if (record.status === 'Pendiente') {
          const progress = document.createElement('small'); progress.textContent = `${record.completed_terms} de 4 notas`; cell.append(progress);
        }
      }
      row.append(cell);
    });
    const cell = document.createElement('td'); cell.dataset.label = 'Acciones';
    const actions = document.createElement('div'); actions.className = 'actions';
    if (summary) {
      const view = document.createElement('button'); view.type = 'button'; view.textContent = 'Ver notas';
      view.addEventListener('click', () => switchTab('grades', { student_id: record.student_id, q: record.student.registration_number, subject: record.subject, academic_year: record.academic_year }));
      actions.append(view); cell.append(actions); row.append(cell); return row;
    }
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

function formatScore(score) {
  return score === null ? 'Sin nota' : Number(score).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

$('filters').addEventListener('submit', (event) => {
  event.preventDefault();
  state.filters = { q: $('search').value.trim(), section: $('filter-section').value };
  if (state.tab !== 'students') Object.assign(state.filters, { subject: $('filter-subject').value.trim(), academic_year: $('filter-year').value });
  if (state.tab === 'grades') state.filters.period = $('filter-period').value;
  state.page = 1; loadRecords();
});
$('clear-filters').addEventListener('click', () => switchTab(state.tab));
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
    $('student-section').value = record?.section ?? state.filters.section ?? 'A';
    if (!$('student-section').value) $('student-section').value = 'A';
    $('student-error').textContent = '';
    $('student-dialog').showModal();
  } else {
    $('grade-form').reset(); $('student-search-form').reset();
    $('grade-title').textContent = record ? 'Editar calificación' : 'Registrar calificación';
    $('grade-subject').value = record?.subject ?? '';
    $('grade-period').value = record?.period ?? '';
    $('grade-year').value = record?.academic_year ?? state.filters.academic_year ?? currentYear;
    $('grade-score').value = record?.score ?? '';
    $('grade-error').textContent = '';
    $('grade-student').replaceChildren(new Option('Seleccioná un alumno', ''));
    $('grade-dialog').showModal();
    const selected = record?.student || state.rows.find((row) => row.student_id === Number(state.filters.student_id))?.student;
    $('student-search').value = selected?.registration_number || '';
    loadStudentOptions(selected);
  }
}
$('new-record').addEventListener('click', () => openEditor());

async function loadStudentOptions(selected = null) {
  clearTimeout(studentSearchTimer);
  const version = ++studentSearchVersion;
  const term = $('student-search').value.trim();
  $('student-search-status').textContent = 'Buscando alumnos…';
  $('grade-student').disabled = true;
  $('grade-student').replaceChildren(new Option('Seleccioná un alumno', ''));
  try {
    const result = await api(`/students?q=${encodeURIComponent(term)}`);
    if (version !== studentSearchVersion) return;
    const students = [...result.data];
    if (selected && !students.some((student) => student.id === selected.id)) students.unshift(selected);
    $('grade-student').replaceChildren(new Option('Seleccioná un alumno', ''), ...students.map((student) => new Option(`${student.registration_number} · ${student.name} · Sección ${student.section}`, student.id)));
    const match = selected || (term && result.total === 1 ? result.data[0] : null);
    if (match) $('grade-student').value = match.id;
    $('student-search-status').textContent = match
      ? `Seleccionado: ${match.name} · ${match.registration_number} · Sección ${match.section}.`
      : result.total
        ? `${result.total} coincidencias. Elegí al alumno en la lista${result.total > 10 ? ' o escribí su matrícula para precisar la búsqueda; se muestran las primeras 10' : ''}.`
        : 'No se encontraron alumnos. Probá otra búsqueda o agregá uno en Alumnos.';
  } catch (error) { if (version === studentSearchVersion) $('student-search-status').textContent = error.message; }
  finally { if (version === studentSearchVersion) $('grade-student').disabled = false; }
}
$('student-search-form').addEventListener('submit', (event) => { event.preventDefault(); loadStudentOptions(); });
$('student-search').addEventListener('input', () => {
  clearTimeout(studentSearchTimer);
  studentSearchVersion++;
  $('grade-student').replaceChildren(new Option('Seleccioná un alumno', ''));
  $('grade-student').disabled = true;
  $('student-search-status').textContent = 'Buscando alumnos…';
  studentSearchTimer = setTimeout(() => loadStudentOptions(), 250);
});
$('grade-student').addEventListener('change', () => {
  $('student-search-status').textContent = $('grade-student').value
    ? `Seleccionado: ${$('grade-student').selectedOptions[0].textContent}.`
    : 'Elegí un alumno para registrar su calificación.';
});
$('grade-dialog').addEventListener('close', () => {
  clearTimeout(studentSearchTimer);
  studentSearchVersion++;
});

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

async function downloadGrades(filters) {
  const file = await api(`/grades/export/excel?${new URLSearchParams(filters)}`, { download: true });
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a'); link.href = url; link.download = file.filename;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('notice').textContent = `${file.filename} descargado con todos los resultados de los filtros aplicados.`;
}

$('export').addEventListener('click', async (event) => {
  $('list-error').textContent = '';
  try {
    await busy(event.target, 'Preparando Excel…', async () => {
      const filters = { ...state.filters, view: state.tab === 'summary' ? 'annual' : 'grades' };
      if (!filters.student_id && filters.q) {
        const matches = await api(`/students?${new URLSearchParams({ q: filters.q, section: filters.section || '' })}`);
        if (matches.total === 1) filters.student_id = matches.data[0].id;
      }
      if (filters.student_id) { await downloadGrades(filters); return; }
      exportFilters = filters;
      $('export-section').value = filters.section || '';
      $('export-error').textContent = '';
      $('export-dialog').showModal();
    });
  } catch (error) { $('list-error').textContent = error.message; }
});
$('export-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('export-error').textContent = '';
  try {
    await busy(event.submitter, 'Preparando Excel…', async () => {
      await downloadGrades({ ...exportFilters, section: $('export-section').value });
      $('export-dialog').close();
    });
  } catch (error) { $('export-error').textContent = error.message; }
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
