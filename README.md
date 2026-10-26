# Gestión de calificaciones

Aplicación para registrar alumnos, capturar sus calificaciones y descargar los resultados filtrados en Excel. Tiene un único rol de profesor/administrador, con acceso a los registros del sistema.

## Organización

```text
backend/     Laravel: rutas REST, autenticación, validación y exportación
frontend/    HTML, CSS y JavaScript que consumen las rutas REST
bd/          Migraciones, factories, seeders y SQLite local (no versionado)
scripts/     Preparación y arranque en Windows
.vscode/     Tareas para Visual Studio Code
```

Laravel sirve el HTML y los recursos del frontend desde su carpeta separada. El navegador consulta JSON por HTTP; la interfaz no accede directamente a la base de datos. No se necesita un proceso de compilación para usar el frontend.

## Requisitos

- PHP 8.4 y Composer 2. Extensiones: pdo_sqlite, sqlite3, mbstring, intl, openssl, fileinfo, gd, zip, dom, xml, xmlreader y xmlwriter.
- Laravel 13.38 y PhpSpreadsheet 5.10, fijados en `backend/composer.lock`.
- Node.js 22 o superior solamente para las pruebas del navegador. No es necesario para ejecutar la aplicación.

Las herramientas locales de esta computadora están en `.tools`, que no se sube a Git. En otra computadora, instalá PHP y Composer y agregalos al PATH.

## Preparación en Windows

Desde la carpeta del repositorio, en la terminal de Visual Studio Code:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1
```

Abrí http://127.0.0.1:8003. También se puede ejecutar la tarea **Calificaciones: iniciar** desde Terminal > Ejecutar tarea.

El primer comando instala dependencias, copia `.env.example` si no existe, genera la clave de la aplicación, crea SQLite y aplica migraciones y el seeder. No borra datos existentes ni cambia la contraseña de un usuario ya creado.

### Preparación manual / otros sistemas

```sh
cd backend
composer install
cp .env.example .env
php -r "file_exists('../bd/database.sqlite') || touch('../bd/database.sqlite');"
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8003
```

En Windows, antes de usar PHP local, ejecutá `. ./scripts/Activate-Project.ps1` desde la raíz. El archivo `bd/database.sqlite` se resuelve automáticamente; no hace falta configurar una ruta absoluta.

## Cuenta de prueba

- Correo: `admin@test.com`
- Contraseña: `admin123`

Son credenciales de demostración para uso local. Antes del primer seeder se pueden cambiar `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD` en `backend/.env`. El seeder solo crea la cuenta si no existe; no actualiza contraseñas existentes. No se agregan alumnos ficticios al iniciar.

Para cargar los datos de práctica, ejecutá desde `backend`:

```sh
php artisan db:seed --class=SchoolDemoSeeder
```

Este seeder agrega diez alumnos identificados como Prueba (cinco en la Sección A y cinco en la Sección B) y 79 notas de Matemática y Comunicación y Lenguaje. Incluye aprobados, reprobados, un promedio de exactamente 60 y un bimestre pendiente. En esta computadora ya está ejecutado. Repetirlo no duplica registros ni sobrescribe notas modificadas. Las matrículas comienzan con `DEMO-` y las personas son ficticias.

## Uso

1. Iniciá sesión y agregá un alumno con nombre, matrícula única y sección (`A` o `B`).
2. Abrí Calificaciones y presioná Registrar calificación. Escribí el nombre o la matrícula para buscar al alumno (sin distinguir tildes ni mayúsculas); si hay una única coincidencia, se selecciona automáticamente.
3. Ingresá asignatura, ciclo escolar, uno de los cuatro bimestres y nota de 0 a 100, con hasta dos decimales.
4. Usá Editar para corregir el registro. Solo se admite una nota por alumno, asignatura, ciclo y bimestre.
5. Aplicá filtros de alumno/matrícula, asignatura, bimestre, ciclo y sección (`A`, `B` o ambas) con Buscar. Limpiar restablece el ciclo actual y quita los demás filtros.
6. Descargar Excel genera un `.xlsx` con **todos los resultados de los filtros aplicados**, aunque ocupen varias páginas. Si la consulta identifica a un único alumno, descarga directamente `Calificaciones de <Alumno>.xlsx`; si es una consulta general, permite elegir entre ambas secciones (`Calificaciones generales.xlsx`), `Sección A` (`Calificaciones generales - Sección A.xlsx`) o `Sección B` (`Calificaciones generales - Sección B.xlsx`). En Calificaciones incluye las notas individuales y en Resumen anual incluye los cuatro bimestres, el promedio y el resultado, además de la sección.
7. Eliminar pide confirmación. Un alumno con notas no puede eliminarse hasta quitar sus calificaciones. Cerrar sesión también pide confirmación.

Los listados muestran diez registros por página. Las notas y fechas del Excel son valores numéricos y fechas de Excel; las matrículas conservan sus ceros iniciales. Los textos no se interpretan como fórmulas.

### Cuatro bimestres y aprobación

La regla confirmada para este proyecto es `promedio anual = (B1 + B2 + B3 + B4) / 4`, por alumno, asignatura y ciclo. **Aprobado** desde 60, **Reprobado** por debajo de 60 y **Pendiente** si falta una nota. Un cero registrado sí cuenta; una nota faltante no se convierte en cero. Hasta completar las cuatro notas no se publica un promedio final.

La decisión usa el valor completo del promedio. Se muestran hasta cuatro decimales para evitar que 59.9975 aparezca como 60 y confunda el resultado. Ver notas abre los registros de ese alumno, asignatura y ciclo para editarlos. El resultado se recalcula al editar o eliminar una nota.

## API REST

Base local: `http://127.0.0.1:8003`. Las rutas no tienen prefijo `/api`, para conservar los nombres del documento de requisitos.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/auth/csrf` | Obtener token CSRF y cookie de sesión |
| POST | `/auth/login` | Iniciar sesión con `email` y `password` |
| GET | `/auth/me` | Consultar la sesión actual |
| POST | `/auth/logout` | Cerrar sesión e invalidarla |
| GET, POST | `/students` | Listar o crear alumnos |
| GET, PUT, PATCH, DELETE | `/students/{id}` | Consultar, editar o eliminar un alumno |
| GET, POST | `/grades` | Listar o registrar calificaciones |
| GET | `/grades/summary` | Resumen anual por alumno, asignatura y ciclo |
| GET, PUT, PATCH, DELETE | `/grades/{id}` | Consultar, editar o eliminar una nota |
| GET | `/grades/export/excel` | Descargar las calificaciones filtradas |

Todo excepto `/auth/csrf` y `/auth/login` requiere sesión. El login admite cinco intentos por minuto por correo/IP y veinte por IP. La exportación admite diez solicitudes por minuto.

### Probar con Postman

1. Hacé GET a `/auth/csrf`. Postman conservará la cookie; copiá `csrf_token` de la respuesta.
2. En POST `/auth/login`, agregá `Accept: application/json`, `Content-Type: application/json` y `X-CSRF-TOKEN: el_token_copiado`. En Body > raw > JSON:

```json
{"email":"admin@test.com","password":"admin123"}
```

3. El login devuelve un **nuevo** `csrf_token`. Usá ese valor en `X-CSRF-TOKEN` para POST, PUT, PATCH y DELETE. Conservá las cookies y el mismo host (no alternés entre localhost y 127.0.0.1). Aquí la autenticación usa sesión, no Bearer Token.
4. Crear alumno, POST `/students` (`section` acepta `A` o `B`; si se omite en POST, usa `A`):

```json
{"name":"Alumno de prueba","registration_number":"2026-001","section":"A"}
```

5. Crear nota, POST `/grades`, sustituyendo `student_id` por el ID obtenido:

```json
{"student_id":1,"subject":"Matemática","academic_year":2026,"period":"Bimestre 1","score":85.50}
```

6. Consultar: GET `/grades?q=2026-001&subject=Matemática&period=Bimestre%201&academic_year=2026&section=A&page=1`. El filtro `q` busca por nombre o matrícula sin distinguir tildes ni mayúsculas. El Excel acepta los mismos filtros y omite la paginación. `student_id` y `section` (`A` o `B`) también están disponibles en la API.

El resumen usa `/grades/summary?academic_year=2026`. Su Excel usa `/grades/export/excel?view=annual&academic_year=2026`. Ambos admiten alumno (`q` o `student_id`), asignatura, ciclo y sección (`A` o `B`). El resumen siempre considera los cuatro bimestres y omite cualquier filtro de bimestre. La API valida los cuatro nombres exactos `Bimestre 1` a `Bimestre 4`, secciones `A` o `B` y ciclos entre 2000 y 2100. En POST, si se omite el ciclo, se usa el actual; en PUT se envía el registro completo.

PUT requiere el registro completo. PATCH de calificaciones admite campos parciales; PATCH de alumnos requiere nombre y matrícula (y opcionalmente sección). Respuestas: 200 consulta/edición, 201 creación, 204 eliminación, 401 sesión ausente o vencida, 404 registro inexistente, 409 alumno con notas, 419 CSRF inválido, 422 validación y 429 límite de solicitudes.

## Sesión y configuración

La sesión se almacena en SQLite y el navegador recibe una cookie HttpOnly con SameSite=Lax. JavaScript no guarda credenciales ni tokens de autenticación en localStorage. Las escrituras están protegidas por CSRF y las contraseñas se almacenan con bcrypt. La sesión expira tras 120 minutos sin actividad; la interfaz vuelve al login cuando recibe 401/419.

Para servir por HTTPS, configurá `APP_URL` y `SESSION_SECURE_COOKIE=true`. Mantené `APP_DEBUG=false` y una `APP_KEY` propia. `.env`, SQLite y herramientas locales están excluidos de Git. Esta entrega funciona localmente; no incluye alojamiento público.

## Pruebas

Backend, desde `backend`:

```sh
php artisan test
php vendor/bin/pint --dirty --format agent
```

Navegador, con la aplicación ejecutándose en 8003 y Microsoft Edge instalado:

```sh
cd frontend
npm ci
npm run check
npm test
```

El test del navegador usa la cuenta de prueba, crea registros temporales identificados como E2E y los elimina al terminar. No debe ejecutarse contra una base de producción. Se puede cambiar el servidor con `APP_URL` y el navegador con `BROWSER_CHANNEL`.

Verificación del backend: 21 pruebas y 289 aserciones. Incluye límites de notas, duplicados, relaciones, autorización, filtros, búsqueda sin tildes ni mayúsculas, secciones A y B, nombres de archivo por alumno o sección, exportación de varias páginas, texto que parece fórmula, cálculo anual, separación de ciclos, cero frente a nota faltante y datos de prueba idempotentes. Los recorridos del navegador cubren formularios, resumen, secciones, búsqueda en vivo, sesión, filtros, Excel, errores y tamaños de pantalla. El detalle visual y funcional está en [VERIFICACION.md](VERIFICACION.md).

Referencias técnicas utilizadas: [autenticación de Laravel](https://laravel.com/docs/13.x/authentication), [PhpSpreadsheet](https://phpspreadsheet.readthedocs.io/en/latest/topics/recipes/) y [Playwright](https://playwright.dev/docs/api/class-locator).
