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

## Uso

1. Iniciá sesión y agregá un alumno con nombre y matrícula única.
2. Abrí Calificaciones y presioná Registrar calificación. Buscá al alumno por matrícula si no aparece entre los primeros diez resultados.
3. Ingresá asignatura, período o unidad y nota de 0 a 100, con hasta dos decimales.
4. Usá Editar para corregir el registro. No se admite otra nota del mismo alumno, asignatura y período; para otra evaluación usá un período diferente.
5. Aplicá filtros de alumno/matrícula, asignatura y período con Buscar. Limpiar vuelve a mostrar todos los registros.
6. Descargar Excel genera un `.xlsx` con **todos los resultados de los filtros aplicados**, aunque ocupen varias páginas. El archivo incluye ID, alumno, matrícula, asignatura, período, calificación y fecha de captura.
7. Eliminar pide confirmación. Un alumno con notas no puede eliminarse hasta quitar sus calificaciones. Cerrar sesión también pide confirmación.

Los listados muestran diez registros por página. Las notas y fechas del Excel son valores numéricos y fechas de Excel; las matrículas conservan sus ceros iniciales. Los textos no se interpretan como fórmulas.

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
4. Crear alumno, POST `/students`:

```json
{"name":"Alumno de prueba","registration_number":"2026-001"}
```

5. Crear nota, POST `/grades`, sustituyendo `student_id` por el ID obtenido:

```json
{"student_id":1,"subject":"Matemática","period":"Unidad 1","score":85.50}
```

6. Consultar: GET `/grades?q=2026-001&subject=Matemática&period=Unidad%201&page=1`. El Excel acepta los mismos filtros y omite la paginación. `student_id` es un filtro adicional disponible en la API.

PUT requiere el registro completo. PATCH de calificaciones admite campos parciales; PATCH de alumnos requiere nombre y matrícula. Respuestas: 200 consulta/edición, 201 creación, 204 eliminación, 401 sesión ausente o vencida, 404 registro inexistente, 409 alumno con notas, 419 CSRF inválido, 422 validación y 429 límite de solicitudes.

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

Verificación realizada: 10 pruebas de backend, 100 aserciones y un recorrido completo del navegador. Incluye límites de notas, duplicados, relaciones, autorización, filtros, exportación de varias páginas, texto que parece fórmula, sesión, errores y tamaños de pantalla. El detalle visual y funcional está en [VERIFICACION.md](VERIFICACION.md).

Referencias técnicas utilizadas: [autenticación de Laravel](https://laravel.com/docs/13.x/authentication), [PhpSpreadsheet](https://phpspreadsheet.readthedocs.io/en/latest/topics/recipes/) y [Playwright](https://playwright.dev/docs/api/class-locator).
