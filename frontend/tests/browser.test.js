import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';

test('registro escolar: formularios, filtros, Excel, sesión y tamaños de pantalla', { timeout: 180000 }, async () => {
  const baseURL = process.env.APP_URL || 'http://127.0.0.1:8003';
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('status of 4') && !message.text().includes('status of 5')) errors.push(message.text());
  });
  const marker = `E2E-${Date.now()}`;
  const students = [];
  const grades = [];
  let csrf;
  const log = (message) => console.log(`PASS: ${message}`);
  async function request(path, method = 'GET', data) {
    return context.request.fetch(path, { method, data, headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf || '' } });
  }
  async function login() {
    await page.locator('#email').fill('admin@test.com');
    await page.locator('#password').fill('admin123');
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.locator('#workspace')).toBeVisible();
    await expect(page.locator('#list-status')).not.toContainText('Cargando');
    csrf = (await (await request('/auth/csrf')).json()).csrf_token;
  }
  await mkdir('../.tools/verification', { recursive: true });
  try {
    await page.goto('/');
    await expect(page.locator('#login-panel')).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    assert.equal(await page.locator('#email').evaluate((element) => element.validity.valueMissing), true);
    await page.locator('#email').fill('admin@test.com');
    await page.locator('#password').fill('incorrecta');
    await page.locator('#show-password').click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.locator('#show-password').click();
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.locator('#login-error')).toContainText('no coinciden');
    await page.screenshot({ path: '../.tools/verification/login.png', fullPage: true });
    await login();
    log('Login: campos obligatorios, error de credenciales y mostrar/ocultar contraseña.');
    const session = (await context.cookies()).find((cookie) => cookie.name.endsWith('-session'));
    assert.equal(session.httpOnly, true);
    assert.equal(session.sameSite, 'Lax');
    const noCsrf = await context.request.post('/students', { data: { name: 'No crear', registration_number: marker } });
    assert.equal(noCsrf.status(), 419);
    log('Sesión HttpOnly y SameSite; POST sin CSRF rechazado con 419.');

    await page.getByRole('button', { name: 'Agregar alumno', exact: true }).click();
    await page.locator('#student-dialog').getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Agregar alumno', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#student-dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Agregar alumno', exact: true }).click();
    await page.locator('#student-name').fill('Sofía de prueba de interfaz');
    await page.locator('#student-registration').fill(marker);
    await page.locator('#student-section').selectOption('B');
    await page.getByRole('button', { name: 'Guardar alumno' }).click();
    await expect(page.locator('#student-dialog')).not.toBeVisible();
    await expect(page.locator('#table-body')).toContainText(marker);
    const student = (await (await request(`/students?q=${marker}`)).json()).data[0];
    assert.equal(student.section, 'B');
    students.push(student.id);
    await page.locator('#search').fill('SOFIA DE PRUEBA');
    await page.locator('#filter-section').selectOption('B');
    await page.locator('#filters').getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.locator('#table-body tr')).toHaveCount(1);
    const studentRow = page.locator('#table-body tr').filter({ hasText: marker });
    await studentRow.getByRole('button', { name: 'Editar' }).click();
    await page.locator('#student-name').fill('Sofía de prueba editada');
    await page.locator('#student-section').selectOption('A');
    await page.getByRole('button', { name: 'Guardar alumno' }).click();
    await expect(page.locator('#student-dialog')).not.toBeVisible();
    await expect(page.locator('#list-status')).toContainText('No hay resultados');
    await page.locator('#clear-filters').click();
    await expect(page.locator('#table-body')).toContainText('Sofía de prueba editada');
    log('Alumnos: crear, editar, secciones A/B, búsqueda sin tildes y cerrar con Cancelar/Escape.');

    for (let index = 0; index < 11; index++) {
      const response = await request('/students', 'POST', { name: `Alumno temporal ${index}`, registration_number: `${marker}-${index}` });
      assert.equal(response.status(), 201); students.push((await response.json()).data.id);
    }
    await page.locator('#search').fill(marker);
    await page.locator('#filters').getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.locator('#list-status')).toContainText('de 12 registros');
    await page.locator('#next').click();
    await expect(page.locator('#page-label')).toHaveText('Página 2 de 2');
    await page.locator('#previous').click();
    await expect(page.locator('#page-label')).toHaveText('Página 1 de 2');
    await page.locator('#search').fill('SIN-RESULTADOS-'+marker);
    await page.locator('#filters').getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.locator('#list-status')).toContainText('No hay resultados');
    await page.locator('#clear-filters').click();
    await expect(page.locator('#records')).toBeVisible();
    log('Búsqueda, estado vacío, limpiar filtros y paginación en ambos sentidos.');

    await page.locator('#tab-grades').click();
    await page.getByRole('button', { name: 'Registrar calificación', exact: true }).click();
    await page.locator('#grade-dialog').getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Registrar calificación', exact: true }).click();
    await page.locator('#student-search').fill(marker);
    await page.getByRole('button', { name: 'Buscar alumno', exact: true }).click();
    await expect(page.locator('#grade-student')).toBeEnabled();
    await page.locator('#student-search').fill(marker.toLowerCase()+'-0');
    await expect(page.locator('#grade-student option')).toHaveCount(2);
    await expect(page.locator('#grade-student')).toHaveValue(String(students[1]));
    await page.locator('#grade-subject').fill('Matemática de prueba');
    await page.locator('#grade-period').selectOption('Bimestre 1');
    await page.locator('#grade-score').fill('101');
    await page.getByRole('button', { name: 'Guardar calificación' }).click();
    assert.equal(await page.locator('#grade-score').evaluate((element) => element.validity.rangeOverflow), true);
    await page.locator('#grade-score').fill('87.50');
    await page.getByRole('button', { name: 'Guardar calificación' }).click();
    await expect(page.locator('#grade-dialog')).not.toBeVisible();
    await expect(page.locator('#table-body')).toContainText('87.50');
    const grade = (await (await request('/grades?subject=Matemática%20de%20prueba')).json()).data.find((row) => row.student_id === students[1]);
    grades.push(grade.id);
    await page.locator('#table-body tr').filter({ hasText: 'Matemática de prueba' }).getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('#grade-student')).toBeEnabled();
    await page.locator('#grade-score').fill('93');
    await page.getByRole('button', { name: 'Guardar calificación' }).click();
    await expect(page.locator('#grade-dialog')).not.toBeVisible();
    await expect(page.locator('#table-body')).toContainText('93.00');
    await page.locator('#filter-subject').fill('Matemática de prueba');
    await page.locator('#filter-period').selectOption('Bimestre 1');
    await page.locator('#filters').getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.locator('#records')).toBeVisible();
    await page.locator('#export').click();
    await expect(page.locator('#export-dialog')).toBeVisible();
    await page.locator('#export-dialog').getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('#export-dialog')).not.toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export').click();
    await page.locator('#export-section').selectOption('A');
    await page.locator('#export-form').getByRole('button', { name: 'Descargar Excel', exact: true }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'Calificaciones generales - Sección A.xlsx');
    await download.saveAs('../.tools/verification/calificaciones.xlsx');
    assert.equal(await download.failure(), null);
    log('Notas: búsqueda en vivo con autoselección, validación 0 a 100, alta, edición, filtros y descarga XLSX por sección.');

    for (const width of [320, 390, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Overflow a ${width}`);
      await page.getByRole('button', { name: 'Registrar calificación', exact: true }).click();
      await expect(page.locator('#grade-dialog')).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.keyboard.press('Escape');
      if (width === 390 || width === 1280) await page.screenshot({ path: `../.tools/verification/grades-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 640, height: 450 });
    await page.locator('#tab-students').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#list-title')).toHaveText('Alumnos');
    const focus = await page.locator('#tab-students').evaluate((element) => getComputedStyle(element).outlineStyle);
    assert.notEqual(focus, 'none');
    log('320/390/768/1024/1280 px sin desbordes, formularios replegados y teclado con foco visible.');

    await page.setViewportSize({ width: 390, height: 700 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Texto al 200% sin desbordes');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.locator('#tab-grades').click();
    await page.getByRole('button', { name: 'Registrar calificación', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 300 });
    await page.locator('#grade-score').focus();
    await page.locator('#grade-score').scrollIntoViewIfNeeded();
    const scoreBox = await page.locator('#grade-score').boundingBox();
    assert.ok(scoreBox.y >= 0 && scoreBox.y + scoreBox.height <= 300);
    await page.keyboard.press('Escape');
    log('Texto al 200% y campo enfocado visible con altura reducida para simular el teclado.');

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('#tab-students').click();
    await page.locator('#search').fill(marker+'-0');
    await page.locator('#filters').getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.locator('#table-body tr')).toHaveCount(1);
    await page.locator('#table-body').getByRole('button', { name: 'Eliminar' }).click();
    await page.locator('#confirm-action').click();
    await expect(page.locator('#confirm-error')).toContainText('tiene calificaciones');
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Cancelar' }).click();
    await page.locator('#tab-grades').click();
    await expect(page.locator('#records')).toBeVisible();
    await page.locator('#table-body tr').filter({ hasText: 'Matemática de prueba' }).getByRole('button', { name: 'Eliminar' }).click();
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Cancelar' }).click();
    await page.locator('#table-body tr').filter({ hasText: 'Matemática de prueba' }).getByRole('button', { name: 'Eliminar' }).click();
    await page.locator('#confirm-action').click();
    await expect(page.locator('#confirm-dialog')).not.toBeVisible();
    await page.locator('#tab-students').click();
    await page.locator('#search').fill(marker+'-0');
    await page.locator('#filters').getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.locator('#table-body tr')).toHaveCount(1);
    await page.locator('#table-body').getByRole('button', { name: 'Eliminar' }).click();
    await page.locator('#confirm-action').click();
    await expect(page.locator('#confirm-dialog')).not.toBeVisible();
    log('Eliminar: cancelación, protección de alumnos con notas y eliminación real de ambos registros.');

    await page.route('**/students?**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await page.locator('#clear-filters').click();
    await expect(page.locator('#list-error')).toContainText('No se pudo');
    await page.unroute('**/students?**');
    await page.locator('#retry').click();
    await expect(page.locator('#records')).toBeVisible();
    log('Error de red/servidor visible y botón Volver a cargar operativo.');
    await page.locator('#logout').click();
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('#workspace')).toBeVisible();
    await page.locator('#logout').click();
    await page.locator('#confirm-action').click();
    await expect(page.locator('#login-panel')).toBeVisible();
    await login();
    await context.clearCookies();
    await page.locator('#tab-grades').click();
    await expect(page.locator('#login-error')).toContainText('sesión venció');
    await expect(page.locator('#workspace')).not.toBeVisible();
    log('Cerrar sesión con confirmación y recuperación ante sesión vencida.');
    assert.deepEqual(errors, []);
    log('Sin errores JavaScript no controlados.');
  } finally {
    csrf = (await (await request('/auth/csrf')).json()).csrf_token;
    const signedIn = await request('/auth/login', 'POST', { email: 'admin@test.com', password: 'admin123' });
    assert.equal(signedIn.status(), 200, 'Sesión necesaria para limpiar los registros temporales');
    csrf = (await signedIn.json()).csrf_token;
    for (const id of grades) await request(`/grades/${id}`, 'DELETE');
    for (const id of students) await request(`/students/${id}`, 'DELETE');
    await request('/auth/logout', 'POST');
    await browser.close();
  }
});

test('resumen anual: promedio, estados, ciclo, detalle y Excel', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ baseURL: process.env.APP_URL || 'http://127.0.0.1:8003', viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const marker = `ANUAL-${Date.now()}`;
  const gradeIds = [];
  const errors = [];
  let studentId;
  let csrf;
  page.on('pageerror', (error) => errors.push(error.message));
  async function request(path, method = 'GET', data) {
    return context.request.fetch(path, { method, data, headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf || '' } });
  }
  async function showSummary() {
    await page.locator('#tab-summary').click();
    await page.locator('#search').fill(marker);
    await page.locator('#filters').getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.locator('#table-body tr')).toHaveCount(2);
  }
  try {
    await page.goto('/');
    await expect(page.locator('#login-panel')).toBeVisible();
    await page.screenshot({ path: '../.tools/verification/login-updated.png', fullPage: true });
    await page.locator('#email').fill('admin@test.com');
    await page.locator('#password').fill('admin123');
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.locator('#workspace')).toBeVisible();
    csrf = (await (await request('/auth/csrf')).json()).csrf_token;
    const studentResponse = await request('/students', 'POST', { name: 'Alumno del resumen de prueba', registration_number: marker });
    assert.equal(studentResponse.status(), 201);
    studentId = (await studentResponse.json()).data.id;
    const year = new Date().getFullYear();
    for (const [subject, scores] of [['Materia anual de prueba', [50, 60, 70, 60]], ['Materia pendiente de prueba', [75, 80, 85]]]) {
      for (const [index, score] of scores.entries()) {
        const response = await request('/grades', 'POST', { student_id: studentId, subject, academic_year: year, period: `Bimestre ${index + 1}`, score });
        assert.equal(response.status(), 201); gradeIds.push((await response.json()).data.id);
      }
    }
    await showSummary();
    const approved = page.locator('#table-body tr').filter({ hasText: 'Materia anual de prueba' });
    const pending = page.locator('#table-body tr').filter({ hasText: 'Materia pendiente de prueba' });
    await expect(approved).toContainText('Aprobado');
    await expect(approved.locator('td[data-label="Promedio"]')).toHaveText('60.00');
    await expect(pending).toContainText('Pendiente');
    await expect(pending).toContainText('3 de 4 notas');
    await expect(pending.locator('td[data-label="Bim. 4"]')).toHaveText('Sin nota');
    await expect(page.locator('#period-filter')).not.toBeVisible();
    await approved.getByRole('button', { name: 'Ver notas' }).click();
    await expect(page.locator('#list-title')).toHaveText('Calificaciones por bimestre');
    await expect(page.locator('#table-body tr')).toHaveCount(4);
    await page.locator('#table-body tr').filter({ hasText: 'Bimestre 1' }).getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('#grade-student')).toBeEnabled();
    await expect(page.locator('#grade-period')).toHaveValue('Bimestre 1');
    await page.locator('#grade-score').fill('40');
    await page.getByRole('button', { name: 'Guardar calificación' }).click();
    await expect(page.locator('#grade-dialog')).not.toBeVisible();
    await showSummary();
    await expect(approved).toContainText('Reprobado');
    await expect(approved.locator('td[data-label="Promedio"]')).toHaveText('57.50');
    const downloaded = page.waitForEvent('download');
    await page.locator('#export').click();
    const file = await downloaded;
    assert.equal(file.suggestedFilename(), 'Calificaciones de Alumno del resumen de prueba.xlsx');
    await file.saveAs('../.tools/verification/resumen-anual.xlsx');
    await page.locator('#filter-year').fill(String(year + 1));
    await page.locator('#filters').getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.locator('#list-status')).toContainText('No hay resultados');
    await page.locator('#clear-filters').click();
    await expect(page.locator('#records')).toBeVisible();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Resumen sin overflow a ${width}`);
      if (width === 390 || width === 1440) await page.screenshot({ path: `../.tools/verification/annual-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 700 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Resumen al 200% sin overflow');
    assert.deepEqual(errors, []);
    console.log('PASS: resumen anual con 4 bimestres, aprobado/reprobado/pendiente, edición, filtro de ciclo y Excel.');
    console.log('PASS: resumen responsive a 320/390/768/1024/1440 px y texto al 200%.');
  } finally {
    for (const id of gradeIds) await request(`/grades/${id}`, 'DELETE');
    if (studentId) await request(`/students/${studentId}`, 'DELETE');
    if (csrf) await request('/auth/logout', 'POST');
    await browser.close();
  }
});
