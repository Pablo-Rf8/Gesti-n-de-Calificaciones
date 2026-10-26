# Verificación del proyecto

Revisión del 26 de octubre de 2026. Antislop aplicado durante el desarrollo, según la elección del usuario.

## Dirección y decisiones

Interfaz de registro escolar para un profesor/administrador. La dirección parte de la preferencia del usuario por vistas sencillas y del documento, que pide login, tablas y formularios básicos.

- ENERGY 1 / RHYTHM 1 / MOTION 1: distribución predecible y sin animaciones.
- Verde oscuro: identifica guardar y la sección activa, con contraste comprobado.
- Tema claro fijo: mantiene el registro parecido a una hoja de calificaciones y facilita pasar de la tabla al Excel; responde al alcance simple solicitado.
- Arial del sistema: lectura de formularios y tablas sin descargar fuentes.
- Tabla central: permite consultar alumno, asignatura, período y nota antes de decidir qué editar.
- Dos destinos, Alumnos y Calificaciones: corresponden a los dos registros del alcance; la exportación pertenece a Calificaciones.
- Separaciones de 0.5 a 1.5 rem: agrupan campos relacionados y separan búsqueda, datos y acciones.
- Diálogos nativos: permiten editar y confirmar sin perder la página, con Escape y foco contenido.
- Sin imágenes, iconos, testimonios ni estadísticas decorativas; el nombre del proyecto aparece como texto.
- Los únicos registros iniciales son la cuenta indicada como de prueba. Los datos E2E son temporales y se eliminan tras las pruebas.

## Evidencias funcionales

`backend/tests/Feature/SchoolTest.php` cubre autorización, login/logout, seeder idempotente, CRUD, duplicados, límites 0/100, decimales, filtros, paginación, relaciones y Excel. La suite completa termina con 10 pruebas y 100 aserciones.

`frontend/tests/browser.test.js` ejecuta estos recorridos en Microsoft Edge sin interfaz visible:

| Control o estado | Resultado comprobado |
| --- | --- |
| Iniciar sesión con formulario vacío | Validación del campo requerido |
| Credenciales incorrectas | Mensaje visible, sin entrar al registro |
| Mostrar / Ocultar contraseña | Cambia el tipo del campo en ambos sentidos |
| Login válido | Abre Alumnos y consulta los registros |
| Sesión y CSRF | Cookie HttpOnly/SameSite=Lax; escritura sin CSRF responde 419 |
| Agregar alumno | Guarda y muestra el registro nuevo |
| Editar alumno | Persiste el nombre modificado |
| Cancelar / Escape en diálogos | Cierra sin guardar |
| Buscar / Limpiar | Aplica y elimina filtros |
| Anterior / Siguiente | Cambia entre páginas de diez registros |
| Sin resultados | Explica cómo cambiar o limpiar la búsqueda |
| Registrar calificación | Busca al alumno, valida el rango y guarda la nota |
| Buscar alumno | Filtra las opciones por nombre/matrícula |
| Editar calificación | Guarda y muestra el nuevo valor |
| Descargar Excel | Descarga un archivo .xlsx real y anuncia el resultado |
| Eliminar alumno con notas | Rechaza la acción y explica el motivo |
| Eliminar nota / alumno | Confirmación, cancelación y eliminación real |
| Error al consultar | Mensaje visible y botón Volver a cargar funcional |
| Cerrar sesión | Cancelar mantiene la sesión; confirmar vuelve al login |
| Sesión vencida | Oculta datos y vuelve al login con explicación |
| Tamaños de pantalla | 320, 390, 768, 1024 y 1280 px sin desplazamiento horizontal |
| Texto ampliado | 200% a 390 px sin desbordes |
| Teclado | Enter activa navegación y Escape cierra diálogos, con foco visible |
| Teclado móvil simulado | Campo de nota visible al reducir la altura a 300 px; no sustituye una prueba física en teléfono |
| JavaScript | Sin errores no controlados |

La prueba de backend abre el archivo Excel y verifica doce notas filtradas aunque la tabla tenga diez por página, exclusión de otra asignatura, nota cero numérica, matrícula con ceros y textos que parecen fórmulas guardados como texto.

## Control antislop

### Reglas obligatorias

- R-02 PASS: textos de la aplicación sin raya larga; instrucciones y mensajes concretos.
- R-03 PASS: reflujo de tabla y filtros probado a cinco anchos; controles con altura mínima de 44 px.
- R-17 PASS: contadores provenientes de la paginación de la base de datos.
- R-18 PASS: no hay testimonios ni personas presentadas como clientes.
- R-23 PASS: sin logos ni imágenes inventadas; navegación derivada de Alumnos y Calificaciones del alcance.
- R-24 PASS: ambas opciones de navegación abren su listado real.
- R-25 PASS: contraste de texto, estados y foco calculado; límites de campos comprobados por separado.
- R-26 PASS: recorrido de controles documentado en la tabla anterior y automatizado.
- R-27 PASS: carga, vacío, error, reintento y sesión vencida implementados.
- R-28 PASS: no hay FAQ de relleno.
- R-32 PASS: botones nativos, foco visible, Enter y Escape probados.
- R-33 PASS: implementación en HTML, CSS y JS originales; no hay scripts que reescriban estilos al ejecutar la app.
- R-34 PASS: un único tema claro completo; no existe un modo alternativo incompleto.
- R-35 PASS: aplicación ejecutada en 8003, backend y recorrido de navegador aprobados.
- R-36 PASS: no se publican afirmaciones comerciales o de certificación.
- R-37 PASS: dirección mínima solicitada, lectura de diseño y niveles declarados antes de construir.
- R-38 PASS: datos consultados a la API y cuenta identificada como de prueba; listas iniciales vacías.

### Propósito visual

- R-01 PASS: verde para la acción principal y selección; sin gradientes.
- R-04 PASS: acciones expresadas con texto; sin iconos decorativos.
- R-06 PASS: Arial para lectura de tablas y formularios, sin fuentes remotas.
- R-07 PASS: fondo liso, sin cuadrículas de adorno.
- R-08 PASS: sin flechas decorativas en botones.
- R-09 PASS: sin etiquetas promocionales ni cápsulas.
- R-10 PASS: sin efectos de vidrio.
- R-12 PASS: superficies sin sombras decorativas.
- R-13 PASS: sin resplandores; el foco es un contorno sólido.
- R-14 PASS: datos organizados como registros, no como tarjetas de características.
- R-19 PASS: sin animaciones; estados de hover y foco identifican interacción.
- R-22 PASS: sin ilustraciones ajenas al registro escolar.

### Identidad y jerarquía

- Niveles PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 declarados y respetados.
- Coherencia PASS: formularios y registros mantienen estructura uniforme.
- Foco PASS: login al entrar y listado de registros al iniciar sesión.
- Espacios PASS: separan encabezado, búsqueda, tabla y paginación.
- Acento PASS: verde oscuro limitado a acciones, sección activa y confirmación textual.
- Motivo PASS: matrícula, unidad y nota sobre 100 mantienen la identidad de registro escolar.
- Lectura previa PASS: dirección y niveles anunciados antes de crear la interfaz.

### Calidad y comentarios

- C-1 PASS: decisiones visuales justificadas al inicio de este documento.
- C-2 PASS: acciones conectadas y comprobadas.
- C-3 PASS: solo login, alumnos, notas, búsqueda y exportación del alcance.
- C-4 PASS: casos vacíos, errores, sesión, teclado y reflujo comprobados.
- C-5 PASS: sin estadísticas ni afirmaciones ficticias.
- R-05 PASS: pantalla construida alrededor del registro, sin plantilla promocional.
- R-11 PASS: radios pequeños para campos y contenedores; sin formas de cápsula.
- R-15 PASS: etiquetas específicas: Guardar alumno, Registrar calificación, Descargar Excel.
- R-16 PASS: sin lenguaje promocional.
- R-20 PASS: el contenido y la jerarquía corresponden a alumnos, unidades y notas.
- R-21 PASS: tema claro fijo justificado por el registro escolar y el alcance simple.
- R-29 PASS: neutros, verde funcional y rojo para errores acompañados de texto.
- R-30 PASS: sin reproducción de otra aplicación.
- R-31 PASS: propósito de color, tabla, fuente, espacios y diálogos documentado.
- Comentarios PASS: el código propio evita narración y separadores; el comentario de Excel explica el tratamiento de fórmulas. Se conservan avisos y comentarios del framework.

## Alcance de la entrega

Funciona localmente y está preparado para reproducir la instalación. No hay despliegue público, varios roles, importación de Excel ni recuperación de contraseña, porque no forman parte de este documento de requisitos. La prueba responsive usa un navegador de escritorio; no se afirma haber probado un dispositivo físico.
