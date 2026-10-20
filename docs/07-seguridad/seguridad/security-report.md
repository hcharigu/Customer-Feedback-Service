# Informe de seguridad — Customer Feedback Service

**Fase:** seguridad — Revisión de seguridad  
**Fecha de revisión documental:** 2026-10-06  
**Alcance:** backend, frontend, contrato API, persistencia local y pruebas declaradas.  
**Estado:** revisión estática/documental; no constituye un escaneo, una prueba de penetración, una certificación ni evidencia de ejecución de build o pruebas.

## 1. Alcance, fuentes y limitaciones

### Fuentes revisadas

| Área | Archivos considerados |
|---|---|
| Requisitos y decisiones | `analisis/analisis.md`, `diseno/diseno.md`, `planificacion/plan.md` |
| Contrato | `contrato-api/api-contract.md`, `backend/contrato-api/api-contract.md` |
| Backend | `backend/src/app.js`, `backend/src/server.js`, `backend/src/domain/feedback.js`, `backend/src/services/feedback-service.js`, `backend/src/repositories/file-feedback-repository.js` |
| Frontend | `backend/public/index.html`, `backend/public/app.js`, `backend/public/feedback-client.js`, `backend/public/styles.css` |
| Configuración | `backend/package.json`, `backend/.gitignore`, `backend/playwright.config.js` |
| Cobertura declarada | `backend/tests/**/*.test.js`, `backend/e2e/feedback.spec.js`, `generacion-tests/backend/**/*.test.js`, `generacion-tests/backend/TESTING.md` |
| Evidencia de verificación previa | `compilacion/compilacion.md`, `tests-unitarios/unit-tests.md`, `tests-integracion/integration-tests.md`, `tests-e2e/e2e.md` |

Se toma `backend/` como implementación principal, ya que es la ubicación documentada por `generacion-tests/backend/TESTING.md`. Existen copias de fuentes bajo `frontend/backend/` e `integracion/backend/`; no se evalúan como instancias desplegadas independientes.

### Restricciones conservadas

- La aplicación debe ser pequeña y ejecutable localmente.
- No debe incorporar autenticación, autorización, sesiones, JWT, usuarios, cloud, integraciones ni servicios externos.
- La ruta `/admin` es una capacidad funcional de revisión, no una zona protegida por identidad.
- La persistencia se realiza localmente mediante archivo.

### Limitaciones de la revisión

1. No se proporcionó un entorno en ejecución, configuración de red del host, sistema operativo, permisos reales del directorio de datos, proxy inverso ni configuración de despliegue.
2. No se proporcionó un archivo de bloqueo de dependencias (`package-lock.json`, equivalente) ni inventario SBOM.
3. Los documentos de verificación anteriores indican estado `unavailable` y comprobaciones estructurales; expresamente no acreditan ejecución de build, pruebas unitarias, integración ni E2E.
4. Por estas limitaciones, las conclusiones distinguen entre **evidencia estática**, **inferencia razonable** y **actividad pendiente**.

---

## 2. Criterios aplicados

| Criterio | Versión | Uso en esta revisión |
|---|---|---|
| OWASP Top 10 | **2021** | Clasificación de riesgos según la superficie real: A01 acceso, A02 datos/criptografía, A03 inyección, A04 diseño inseguro, A05 configuración, A06 componentes vulnerables, A07 autenticación, A08 integridad, A09 registro y monitoreo, A10 SSRF. |
| OWASP Application Security Verification Standard (ASVS) | **PR25**, según la guía aportada | Referencia para decidir requisitos verificables de diseño, implementación, pruebas y observabilidad. La guía aportada no especifica una versión final numerada ni identificadores de controles ASVS; por ello no se inventan IDs de requisito. |
| STRIDE | Sin versión aplicable | Modelado de amenazas: suplantación, manipulación, repudio, divulgación, denegación de servicio y elevación de privilegios. |

El nivel ASVS no fue definido por el brief. **Supuesto mínimo:** para una aplicación local que almacena feedback potencialmente sensible y no procesa pagos ni identidad, el objetivo futuro razonable es una línea base equivalente a ASVS Nivel 1, reforzada en controles de validación, manejo de errores, persistencia y exposición de datos. Esta es una recomendación de priorización, no una certificación ni una declaración de cumplimiento.

---

## 3. Superficie, activos y límites de confianza

### Activos

| Activo | Sensibilidad | Motivo |
|---|---|---|
| Mensajes `Feedback.message` | Media a alta | Aunque no se solicitan datos personales, un usuario puede incluir información personal, confidencial o dañina. |
| Archivo local `data/feedback.json` | Alta | Contiene la colección persistida de feedback. |
| Integridad de la colección | Alta | La pérdida, sobrescritura o alteración afecta la revisión funcional. |
| Disponibilidad del servidor y disco local | Media | El servicio acepta creación de entradas y persiste en disco. |
| Integridad del frontend publicado | Alta | Un cambio en `public/app.js` puede afectar las solicitudes y el renderizado. |
| Identificadores y marcas temporales generados por servidor | Media | Previenen que el cliente establezca campos de servidor y determinan orden de revisión. |

### Flujo y límites de confianza

```mermaid
flowchart LR
  U[Usuario local o cliente con acceso al servidor] -->|HTTP / HTTPS según entorno no documentado| B[Express: backend/src/app.js]
  B -->|POST / GET /api/feedback| S[FeedbackService]
  S -->|entidades validadas| R[FileFeedbackRepository]
  R -->|lectura y escritura local| F[(Archivo data/feedback.json)]

  B -->|recursos estáticos| UI[public/index.html + app.js]
  UI -->|fetch mismo origen| B
```

| Límite | Riesgos principales |
|---|---|
| Cliente → API | Payload malformado, asignación masiva, cargas excesivas, abuso de creación, peticiones desde una red no prevista. |
| API → servicio/repository | Persistencia de datos no válidos, errores internos revelados, concurrencia. |
| Repository → sistema de archivos | Exposición local del archivo, corrupción, agotamiento de disco, manipulación por procesos locales. |
| Datos persistidos → frontend | XSS almacenado e indisponibilidad por datos corruptos. |
| Servidor → navegador | Ausencia de cabeceras de protección, cacheo de datos sensibles, framing no deseado. |

---

## 4. Modelo de amenazas STRIDE

| ID | Amenaza | STRIDE | Activo/flujo | Riesgo | Controles observados | Estado |
|---|---|---|---|---|---|---|
| TM-01 | Un tercero con conectividad al servicio consulta `/admin` o `GET /api/feedback`. | S, I | Datos de feedback | Divulgación de todos los mensajes. | No existe autenticación por restricción explícita; documentación lo declara. | Riesgo aceptado por alcance, condicionado a exposición estrictamente local. |
| TM-02 | Contenido de feedback intenta ejecutar JavaScript al mostrarse en revisión. | T, I | Navegador de revisión | XSS almacenado, robo o alteración de contexto del navegador. | `message.textContent = feedback.message` en `backend/public/app.js`; prueba E2E declarada para `<script>`. | Mitigado por diseño; falta recibo de ejecución. |
| TM-03 | Un cliente fuerza `id`, `createdAt` u otros campos. | T, E | Integridad de datos | Asignación masiva, manipulación del orden o de identidad de entradas. | `validateCreateFeedback()` acepta exactamente la clave `message`. | Mitigado por implementación estática. |
| TM-04 | Un cliente envía JSON malformado, tipo incorrecto o mensaje inválido. | T, D | API y archivo local | Errores no controlados, datos inconsistentes o agotamiento de recursos. | Parser JSON de 8 KiB, validación de tipo y límite de 2000 caracteres, respuestas 400/413/415. | Mitigado parcialmente. |
| TM-05 | Abuso sostenido de `POST` llena el archivo o el disco. | D | Disponibilidad y almacenamiento | Indisponibilidad local, crecimiento sin límite del archivo. | Límite por solicitud de 8 KiB; no hay límite de frecuencia, cuota, retención ni límite total. | Hallazgo SEC-003. |
| TM-06 | El servidor se expone fuera de la máquina prevista y no hay identidad para proteger la revisión. | S, I | `/admin`, API, archivo persistido | Divulgación o inserción no autorizada de feedback. | Ausencia deliberada de autenticación; `server.listen(port)` no fija interfaz explícita. | Hallazgo SEC-001. |
| TM-07 | Respuestas o logs revelan rutas locales o errores de E/S. | I, R | API y filesystem | Divulgación de detalles internos. | Errores genéricos; pruebas de contrato declaradas para fallos de repositorio. No hay logging de auditoría. | Mitigado para respuestas; SEC-004 para trazabilidad. |
| TM-08 | Una página externa intenta crear feedback mediante el navegador de una víctima. | T | `POST /api/feedback` | Contaminación de datos. | El endpoint exige `application/json`; el frontend usa mismo origen; no se configuró CORS explícito. | Riesgo reducido por el contrato actual; debe reevaluarse si se añade CORS o se relaja el tipo de contenido. |
| TM-09 | El navegador, una extensión, un proxy local o una sesión compartida recupera feedback desde caché. | I | Respuesta `GET /api/feedback` | Divulgación de mensajes guardados. | No se observan cabeceras `Cache-Control` en `backend/src/app.js`. | Hallazgo SEC-002. |
| TM-10 | Un sitio externo embebe la interfaz y engaña al usuario para interactuar. | T, I | Interfaz web | Clickjacking y envío engañoso de datos. | No se observan `Content-Security-Policy: frame-ancestors`, `X-Frame-Options` ni cabeceras equivalentes. | Hallazgo SEC-002. |

---

## 5. Controles positivos observados

Estos puntos son evidencia de controles presentes en el código revisado, no prueba de que hayan sido ejecutados en un entorno real.

| Área | Evidencia | Cobertura OWASP / ASVS |
|---|---|---|
| Validación autoritativa | `backend/src/domain/feedback.js` rechaza payload no objeto, arreglos, propiedades adicionales, tipos no texto, mensajes vacíos y mensajes mayores de 2000 caracteres. | OWASP 2021 A03 Injection, A04 Insecure Design; ASVS: validación de entrada. |
| Prevención de asignación masiva | La regla `keys.length !== 1 || keys[0] !== 'message'` rechaza `id`, `createdAt` y claves extra. | OWASP 2021 A01 Broken Access Control, A04; ASVS: validación de entrada y asignación de propiedades. |
| Límites de entrada | `express.json({ limit: '8kb', type: 'application/json' })` en `backend/src/app.js`; el contrato limita `message` a 2000 caracteres. | OWASP 2021 A04, A05; ASVS: límites de recursos. |
| Manejo seguro de errores | `backend/src/app.js` devuelve códigos y mensajes genéricos para `500`; no devuelve errores de filesystem. | OWASP 2021 A05, A09; ASVS: manejo seguro de errores. |
| Menor exposición del framework | `app.disable('x-powered-by')` en `backend/src/app.js`. | OWASP 2021 A05; ASVS: configuración segura. |
| XSS almacenado | `backend/public/app.js` usa `textContent` para `feedback.message`; no se observa `innerHTML`, `eval` ni inserción de HTML controlado por usuario. | OWASP 2021 A03 Injection, A04; ASVS: codificación de salida. |
| Persistencia más segura | `backend/src/repositories/file-feedback-repository.js` serializa escrituras dentro del proceso y escribe a temporal antes de `rename`; el archivo nuevo se crea con modo `0o600`. | OWASP 2021 A08 Data Integrity Failures; ASVS: integridad de datos. |
| Exclusión de datos de Git | `backend/.gitignore` excluye `data/`, `.env`, reportes y cobertura. | OWASP 2021 A02 Cryptographic Failures, A05; ASVS: protección de datos y configuración. |
| Identificadores de servidor | `FeedbackService` usa `randomUUID` desde `node:crypto`; `createdAt` se genera en servidor. | OWASP 2021 A04; ASVS: integridad de datos. |
| Aislamiento de pruebas | Pruebas de integración declaradas usan directorios temporales; E2E declara un archivo separado `data/e2e-feedback.json`. | ASVS: pruebas de seguridad y aislamiento de datos. |

---

## 6. Hallazgos

### Resumen

| ID | Severidad | Título | Categorías OWASP 2021 |
|---|---|---|---|
| SEC-001 | Alta | La revisión y la API no tienen control de acceso y la exposición de red no está restringida ni documentada técnicamente. | A01, A04, A07 |
| SEC-002 | Media | Faltan cabeceras de protección del navegador y de no almacenamiento en caché para contenido de feedback. | A05 |
| SEC-003 | Media | No existen límites de frecuencia, cuota ni retención para una colección de feedback sin paginación. | A04, A05 |
| SEC-004 | Baja | No hay registro de seguridad ni trazabilidad operativa para creación, lectura, errores o fallos de persistencia. | A09 |
| SEC-005 | Baja | La protección de permisos del archivo es parcial y no hay validación de ubicación o permisos del almacenamiento existente. | A02, A05, A08 |

### SEC-001 — La revisión y la API no tienen control de acceso y la exposición de red no está restringida ni documentada técnicamente

- **Severidad:** Alta.
- **Estado:** Riesgo conocido y aceptado funcionalmente para autenticación; requiere contención por red y documentación operacional.
- **Ubicación:**
  - `backend/src/server.js`
  - `backend/src/app.js`
  - `backend/README.md`
  - `backend/contrato-api/api-contract.md`
- **Evidencia:**
  - `backend/src/server.js` inicia el servicio con `app.listen(port, ...)` sin una interfaz de escucha explícita.
  - `backend/src/app.js` expone `GET /api/feedback` sin middleware de identidad o autorización.
  - `backend/src/app.js` sirve `/admin` como recurso estático sin control de acceso.
  - `backend/README.md` afirma que cualquier persona que pueda acceder a la aplicación local puede abrir `/admin`.
  - `backend/contrato-api/api-contract.md` declara explícitamente que no existe autenticación ni autorización.
- **Impacto:** Cualquier persona o proceso que pueda alcanzar el servidor puede leer todos los mensajes mediante la API o la vista de revisión y puede crear entradas. Si el servidor queda accesible desde una LAN, una interfaz pública, un túnel o un host compartido, la confidencialidad y la integridad de los mensajes quedan comprometidas.
- **Criterios relacionados:** OWASP Top 10 2021 A01 Broken Access Control, A04 Insecure Design y A07 Identification and Authentication Failures; OWASP ASVS PR25 aportado, áreas de arquitectura, control de acceso y protección de datos.
- **Remediación concreta compatible con el brief:**
  1. Mantener la ausencia de autenticación, pues está prohibida por el alcance.
  2. Restringir la escucha del proceso a loopback de forma explícita, por ejemplo configurando el host de escucha como `127.0.0.1` o `::1`, salvo una decisión documentada en contrario.
  3. Documentar que no debe exponerse mediante proxy, túnel, reenvío de puertos ni interfaz LAN.
  4. Si una futura necesidad exige acceso por red, revisar el alcance y añadir un mecanismo de autenticación/autorización antes de habilitarlo; no resolverlo con obscuridad de ruta.
  5. Añadir una prueba de configuración o smoke test que verifique el host de escucha esperado, cuando el entorno de pruebas permita comprobarlo.
- **Validación pendiente:** Confirmar el host efectivo de escucha y las reglas de firewall del entorno local real. La lectura estática no permite determinar si el proceso resulta accesible desde otras máquinas en el entorno de destino.

### SEC-002 — Faltan cabeceras de protección del navegador y de no almacenamiento en caché para contenido de feedback

- **Severidad:** Media.
- **Estado:** Abierto.
- **Ubicación:** `backend/src/app.js`.
- **Evidencia:**
  - El código sólo desactiva `X-Powered-By` mediante `app.disable('x-powered-by')`.
  - No se observa configuración de `Content-Security-Policy`, `X-Frame-Options` o `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` o `Cache-Control`.
  - `GET /api/feedback` devuelve potencialmente toda la colección persistida, sin establecer directivas de caché.
- **Impacto:**
  - Sin protección de framing, una página que pueda alcanzar la aplicación podría intentar embeberla y orientar al usuario a enviar feedback de manera engañosa.
  - Sin una política CSP, una futura regresión de renderizado o una dependencia estática comprometida tendría menor contención en el navegador.
  - Sin `Cache-Control: no-store` para la API y, según la sensibilidad decidida, para `/admin`, mensajes potencialmente personales pueden quedar almacenados en cachés de navegador o intermediarios.
- **Criterios relacionados:** OWASP Top 10 2021 A05 Security Misconfiguration; OWASP ASVS PR25 aportado, áreas de configuración de seguridad HTTP, protección de datos y navegador.
- **Remediación concreta:**
  1. Añadir middleware local, o configuración equivalente del framework, antes de rutas y estáticos, con al menos:
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: no-referrer`
     - `X-Frame-Options: DENY` **o** CSP `frame-ancestors 'none'`
     - `Permissions-Policy` restrictiva, deshabilitando capacidades no usadas.
  2. Definir una CSP compatible con los recursos propios de la aplicación. Como base, evitar orígenes externos y permitir únicamente el origen propio para scripts y estilos. Debe ajustarse al uso de módulos ES locales en `public/index.html`.
  3. Establecer `Cache-Control: no-store` en las respuestas `GET /api/feedback` y en respuestas de error que pudieran incluir información de usuario. Evaluar también `Cache-Control: no-store` para `/admin`.
  4. Añadir pruebas de integración que confirmen las cabeceras mínimas en `GET /api/feedback`, `/` y `/admin`.
- **Validación pendiente:** Confirmar compatibilidad de CSP con el navegador y la forma final de servir estáticos antes de fijar una política estricta.

### SEC-003 — No existen límites de frecuencia, cuota ni retención para una colección de feedback sin paginación

- **Severidad:** Media.
- **Estado:** Abierto.
- **Ubicación:**
  - `backend/src/app.js`
  - `backend/src/repositories/file-feedback-repository.js`
  - `backend/src/server.js`
  - `backend/contrato-api/api-contract.md`
- **Evidencia:**
  - Existe un límite de 8 KiB por cuerpo y 2000 caracteres por mensaje.
  - `POST /api/feedback` permite crear entradas sin autenticación, cuota, rate limit o mecanismo antiabuso.
  - `FileFeedbackRepository.add()` añade cada entrada a un único arreglo JSON.
  - `FileFeedbackRepository.list()` carga la colección completa y la ordena en memoria.
  - El contrato devuelve todas las entradas y no define paginación, tamaño máximo de colección ni retención.
- **Impacto:** Un cliente con acceso puede enviar muchas solicitudes válidas y causar crecimiento persistente del archivo, agotamiento de espacio, mayor uso de memoria y CPU al listar/ordenar, y degradación o indisponibilidad de la aplicación local.
- **Criterios relacionados:** OWASP Top 10 2021 A04 Insecure Design y A05 Security Misconfiguration; OWASP ASVS PR25 aportado, áreas de límites de recursos, disponibilidad y manejo de datos.
- **Remediación concreta:**
  1. Para el alcance local, establecer un límite de tamaño de colección o de archivo y responder con un error seguro al excederlo.
  2. Definir una política explícita de retención e instrucciones locales para borrar o rotar datos. La política debe considerar que el feedback puede contener información personal.
  3. Incorporar paginación o un límite máximo de resultados si el alcance deja de ser estrictamente pequeño. Esto requeriría una versión contractual y pruebas actualizadas.
  4. Si el servicio puede ser invocado por procesos no confiables, añadir un rate limit local acotado por IP o por proceso; no debe depender de un servicio externo.
  5. Añadir pruebas de integración para el límite elegido, verificando que no se corrompe el archivo ni se filtran detalles internos.
- **Supuesto relevante:** La severidad se basa en que el proceso pueda recibir solicitudes repetidas de un cliente accesible. Si el servicio queda estrictamente aislado a un usuario local confiable y el volumen es reducido, el riesgo disminuye, pero el crecimiento indefinido sigue presente.

### SEC-004 — No hay registro de seguridad ni trazabilidad operativa para creación, lectura, errores o fallos de persistencia

- **Severidad:** Baja.
- **Estado:** Abierto.
- **Ubicación:**
  - `backend/src/app.js`
  - `backend/src/server.js`
  - `backend/src/repositories/file-feedback-repository.js`
- **Evidencia:**
  - No se observan logs estructurados para intentos de creación, errores de validación, respuestas 413/415, errores de persistencia ni errores de lectura.
  - `backend/src/app.js` transforma errores de repositorio en respuestas genéricas, lo cual evita filtración al cliente, pero no deja una señal operativa local.
  - `backend/src/server.js` sólo registra el mensaje de inicio del servidor.
- **Impacto:** Un operador local no puede distinguir fácilmente entre abuso, errores de cliente, corrupción del archivo, fallos de disco o errores de aplicación. También se dificulta investigar acciones repudiadas o incidencias de disponibilidad.
- **Criterios relacionados:** OWASP Top 10 2021 A09 Security Logging and Monitoring Failures; OWASP ASVS PR25 aportado, área de observabilidad y registro de eventos de seguridad.
- **Remediación concreta:**
  1. Incorporar registro local estructurado de eventos mínimos: inicio del servidor, creación exitosa sin incluir `message`, validación rechazada, exceso de tamaño, tipo de contenido inválido, fallo de persistencia y fallo de lectura.
  2. No registrar texto completo de feedback, rutas sensibles, cabeceras de autorización —aunque no existen actualmente— ni secretos.
  3. Incluir identificador de correlación por solicitud si se añade una convención local; evitar que provenga sin validación de una cabecera controlada por el usuario.
  4. Documentar ubicación, permisos, retención y rotación de logs locales.
  5. Añadir pruebas unitarias del redactor/sanitizador de logs si se introduce.
- **Nota:** Esta recomendación no implica integrar observabilidad cloud ni servicios externos, prohibidos por el brief.

### SEC-005 — La protección de permisos del archivo es parcial y no hay validación de ubicación o permisos del almacenamiento existente

- **Severidad:** Baja.
- **Estado:** Abierto.
- **Ubicación:**
  - `backend/src/server.js`
  - `backend/src/repositories/file-feedback-repository.js`
  - `backend/README.md`
- **Evidencia:**
  - La ruta se toma de `FEEDBACK_DATA_FILE` o se resuelve como `data/feedback.json`.
  - El repositorio crea archivos nuevos con `mode: 0o600`.
  - No se observa una comprobación de permisos de un archivo ya existente ni del directorio padre.
  - No se observa validación de que `FEEDBACK_DATA_FILE` permanezca en una ubicación de datos aprobada; la variable está bajo control del operador, no del cliente HTTP.
- **Impacto:** En un equipo multiusuario o con directorios compartidos, un archivo existente con permisos permisivos, una ruta configurada de forma insegura o el acceso al directorio padre puede revelar feedback. La variable de entorno no es una vulnerabilidad remota por sí misma, pero aumenta el riesgo de configuración insegura.
- **Criterios relacionados:** OWASP Top 10 2021 A02 Cryptographic Failures, A05 Security Misconfiguration y A08 Software and Data Integrity Failures; OWASP ASVS PR25 aportado, áreas de protección de datos en reposo y configuración segura.
- **Remediación concreta:**
  1. Documentar que `FEEDBACK_DATA_FILE` debe apuntar a un directorio privado del usuario/servicio y nunca a un recurso publicado.
  2. Crear el directorio de datos con permisos restrictivos cuando el runtime y la plataforma lo permitan.
  3. Tras abrir o crear el archivo, comprobar permisos cuando la plataforma lo soporte y advertir localmente si son más amplios que los esperados.
  4. Mantener el archivo de datos y temporales fuera de `public/`, como ya hace la estructura actual.
  5. Si se admite ejecución en entornos multiusuario, definir el usuario del proceso y permisos de filesystem como parte de las instrucciones de ejecución.
- **Límite:** La semántica de permisos es dependiente de plataforma; el comportamiento efectivo debe verificarse en el sistema operativo objetivo.

---

## 7. Riesgos aceptados y decisiones obligatorias del alcance

### RA-001 — La ruta de revisión no tiene autenticación

- **Severidad inherente:** Alta para confidencialidad si el servicio se expone a usuarios no confiables.
- **Decisión:** Aceptada únicamente porque el contexto original prohíbe añadir autenticación, sesiones, JWT, usuarios o proveedores de identidad.
- **Evidencia:** `backend/README.md`, `backend/contrato-api/api-contract.md`, `diseno/diseno.md` DD-009.
- **Condición de aceptación:** El servicio debe permanecer limitado a un entorno local y de confianza. SEC-001 debe mitigarse mediante restricción de red y documentación.
- **No es válido:** Afirmar que `/admin` está protegida, ocultar el enlace o depender de la ruta `/admin` como mecanismo de seguridad.

### RA-002 — Persistencia local en archivo

- **Severidad inherente:** Media para integridad y disponibilidad.
- **Decisión:** Compatible con el requisito de solución pequeña, local y sin infraestructura externa.
- **Evidencia:** `backend/src/repositories/file-feedback-repository.js`.
- **Condición de aceptación:** Escrituras serializadas en proceso, reemplazo con archivo temporal, ubicación fuera de recursos estáticos y exclusión de Git. Estos controles están presentes en el código, pero quedan pendientes las mejoras de permisos, límites de volumen y recuperación operativa.

---

## 8. Revisión por categorías OWASP Top 10 2021

| Categoría | Evaluación basada en evidencia | Resultado |
|---|---|---|
| A01: Broken Access Control | No hay control de acceso para `/admin` ni `GET /api/feedback`. Es una restricción explícita, no una omisión desconocida. | Riesgo aceptado condicionado; SEC-001. |
| A02: Cryptographic Failures | No se observan secretos ni cifrado. El archivo contiene datos potencialmente sensibles sin cifrado en reposo; para alcance local, se mitiga parcialmente con permisos y ubicación privada. | SEC-005; transporte HTTPS no verificable. |
| A03: Injection | Validación estricta de JSON y renderizado mediante `textContent`. No hay consulta SQL, shell, template dinámico ni HTML no saneado observados. | Mitigación presente; requiere conservar pruebas. |
| A04: Insecure Design | Límites por solicitud existen, pero no hay cuota, retención o límite de colección. La falta de autenticación es una decisión de alcance que exige aislamiento local. | SEC-001 y SEC-003. |
| A05: Security Misconfiguration | `X-Powered-By` está deshabilitado; faltan cabeceras de navegador y caché. Permisos y exposición de red necesitan endurecimiento. | SEC-001, SEC-002 y SEC-005. |
| A06: Vulnerable and Outdated Components | Se declaran `express ^4.21.2`, `vitest ^3.2.4`, `supertest ^7.1.1` y Playwright `^1.52.0`, pero no hay lockfile ni resultados de análisis de dependencias. | No concluible; actividad pendiente. |
| A07: Identification and Authentication Failures | No aplica como fallo de implementación de login porque no existe autenticación por requisito. La consecuencia de acceso no restringido sí debe contenerse por red. | RA-001 y SEC-001. |
| A08: Software and Data Integrity Failures | IDs y timestamps son del servidor; escritura temporal y `rename` reducen corrupción dentro de un proceso. No hay verificación de integridad del archivo ni soporte seguro para múltiples procesos. | Mitigado parcialmente; pendiente de entorno y escalado. |
| A09: Security Logging and Monitoring Failures | No se observan eventos de seguridad ni diagnóstico operativo seguro. | SEC-004. |
| A10: Server-Side Request Forgery | No hay URLs suministradas por usuario, cliente HTTP saliente, webhook ni integración externa. | No aplicable a la superficie revisada. |

---

## 9. Revisión ASVS basada en la guía aportada

La guía de fase identifica **OWASP ASVS PR25** pero no aporta una numeración final ni controles identificados. Por rigor, esta tabla relaciona áreas de verificación sin atribuir IDs no suministrados.

| Área ASVS | Evidencia | Estado |
|---|---|---|
| Arquitectura y diseño seguro | Contrato mínimo, separación entre API, servicio y repositorio; modelo limitado a `message`, `id`, `createdAt`. | Parcialmente conforme por diseño; límites de capacidad pendientes. |
| Validación de entrada | Validación en servidor, rechazo de propiedades extra, tipo JSON exigido, tamaño máximo de 8 KiB. | Implementado en revisión estática. |
| Codificación de salida | `message` se asigna mediante `textContent`. | Implementado en revisión estática. |
| Manejo de errores | Errores API genéricos para persistencia y parseo. | Implementado en revisión estática. |
| Protección de datos | Datos locales excluidos de Git y archivo nuevo con modo `0600`. No hay protección de caché ni verificación de permisos existentes. | Parcial; SEC-002 y SEC-005. |
| Configuración de seguridad | `X-Powered-By` deshabilitado. Faltan cabeceras HTTP, host de escucha explícito y documentación de exposición. | Parcial; SEC-001 y SEC-002. |
| Autenticación y control de acceso | Ausentes por requerimiento. | Riesgo aceptado solo bajo aislamiento local. |
| Registro y monitoreo | No se observan registros de eventos de seguridad. | Pendiente; SEC-004. |
| Integridad de datos y persistencia | Generación de campos de servidor, cola de escritura por proceso y temporal + renombrado. | Parcial; sin garantía entre procesos ni validación del archivo persistido. |
| Pruebas de seguridad | Hay casos declarados para XSS, validación, tamaño de payload, asignación masiva y errores internos. Los recibos previos no acreditan ejecución. | Diseñado; ejecución pendiente. |

---

## 10. Evidencia de pruebas de seguridad declaradas

| Riesgo | Prueba declarada | Archivo | Tipo de evidencia |
|---|---|---|---|
| Asignación masiva | Rechazo de `id`, `createdAt` y claves extra. | `generacion-tests/backend/tests/unit/feedback-domain.test.js`, `generacion-tests/backend/tests/integration/feedback-api.contract.test.js` | Código de prueba presente; no ejecutado según recibos disponibles. |
| JSON inválido y tipo de contenido | Casos de JSON malformado y `text/plain`. | `generacion-tests/backend/tests/integration/feedback-api.contract.test.js` | Código de prueba presente; no ejecutado según recibos disponibles. |
| Límite de carga | Caso CT-008 con cuerpo superior a 8 KiB. | `generacion-tests/backend/tests/integration/feedback-api.contract.test.js` | Código de prueba presente; no ejecutado según recibos disponibles. |
| Fuga de información interna | Caso CT-012 simula rutas privadas en el error del repositorio. | `generacion-tests/backend/tests/integration/feedback-api.contract.test.js` | Código de prueba presente; no ejecutado según recibos disponibles. |
| XSS almacenado | Inserción de `<script>alert(1)</script>` y comprobación de que sólo existe el script legítimo de la aplicación. | `generacion-tests/backend/e2e/feedback.spec.js` | Código de prueba presente; no ejecutado según recibos disponibles. |
| Aislamiento de datos E2E | Eliminación de `data/e2e-feedback.json` antes de suite. | `backend/e2e/global-setup.js` | Código de configuración presente; no ejecutado según recibos disponibles. |

Los documentos `tests-unitarios/unit-tests.md`, `tests-integracion/integration-tests.md` y `tests-e2e/e2e.md` indican que las comprobaciones de toolchain quedaron omitidas. Por tanto, estas pruebas son cobertura **planificada e implementada como código**, no evidencia de resultados satisfactorios.

---

## 11. Actividades pendientes priorizadas

| Prioridad | Actividad | Relación |
|---|---|---|
| P0 | Fijar explícitamente el host loopback de escucha y documentar prohibición de exposición por LAN, túnel o proxy. | SEC-001 |
| P0 | Decidir formalmente si el servicio puede contener feedback sensible. Si la respuesta es sí, aplicar `Cache-Control: no-store` a API y revisión. | SEC-002 |
| P1 | Añadir cabeceras HTTP de protección y pruebas de integración para su presencia. | SEC-002 |
| P1 | Definir límite de colección/archivo, retención y comportamiento al alcanzar la cuota. | SEC-003 |
| P1 | Ejecutar las suites declaradas de unitarias, integración y E2E en un entorno local controlado y conservar recibos de resultados. | Validación de controles existentes |
| P1 | Revisar dependencias con un inventario bloqueado y una herramienta de análisis de vulnerabilidades aplicable a las versiones realmente instaladas. | OWASP A06 |
| P2 | Añadir logging local mínimo, estructurado y sin contenido de feedback. | SEC-004 |
| P2 | Endurecer y comprobar permisos de directorio/archivo de datos en la plataforma objetivo. | SEC-005 |
| P2 | Añadir pruebas de cabeceras de seguridad, no caché, límite de colección y comportamiento de disco lleno/fallo de renombrado. | SEC-002, SEC-003, SEC-005 |

---

## 12. Áreas no verificadas

| Área | Motivo | Actividad necesaria |
|---|---|---|
| Vulnerabilidades conocidas de dependencias directas y transitivas | Falta lockfile, árbol instalado y herramienta de análisis. No se infieren CVEs de los nombres o rangos de dependencias. | Generar SBOM o lockfile y revisar versiones instaladas con análisis aplicable. |
| Ejecución efectiva de pruebas | Los recibos disponibles son estructurales y reportan actividad pendiente. | Ejecutar las suites declaradas y registrar resultados. |
| Exposición de red real | No hay entorno, host OS, firewall, Docker, proxy ni túnel documentados. | Comprobar interfaces de escucha y políticas de red en el entorno local objetivo. |
| HTTPS/transporte | El proyecto documenta HTTP local; no existe configuración TLS revisable. | Determinar si el uso permanece en loopback. Si se expone fuera de loopback, exigir TLS y revisar su configuración. |
| Permisos efectivos del filesystem | Los permisos dependen de SO, umask, existencia previa de archivos y propietario del proceso. | Verificar permisos del directorio y archivo reales en la plataforma objetivo. |
| Corrupción y recuperación del archivo | El repositorio detecta JSON no arreglo, pero no existe estrategia de backup, reparación o recuperación revisada. | Definir runbook local y pruebas de archivo truncado/corrupto. |
| Concurrencia entre procesos | La cola `#writeQueue` cubre un proceso, no varios procesos que apunten al mismo archivo. | Mantener proceso único documentado o introducir bloqueo/almacenamiento apropiado tras ampliar alcance. |
| Cabeceras finales después de proxy | No existe proxy configurado en fuentes. | Revisar respuesta HTTP final si se añade proxy, túnel o servidor local adicional. |
| Accesibilidad automatizada completa | No se observa dependencia axe ni informe de auditoría. | Añadir auditoría compatible si se aprueba y ejecutar la suite correspondiente. |

---

## 13. Conclusión

La implementación revisada incluye controles sólidos y proporcionales contra los riesgos principales de entrada y renderizado: validación autoritativa, límite de cuerpo, rechazo de propiedades adicionales, generación de campos de servidor, errores API sin detalles internos y representación del feedback como texto mediante `textContent`. Estos controles abordan de manera directa XSS almacenado, asignación masiva y persistencia de payloads inválidos.

El riesgo dominante es la **ausencia deliberada de autenticación** para la revisión y la API. Esta condición sólo es aceptable bajo el requisito de operación estrictamente local y confiable; debe compensarse con una escucha explícita en loopback, prohibición documentada de exposición de red y protección de datos en el navegador mediante directivas de no caché. También deben resolverse los límites de crecimiento del archivo, la instrumentación de eventos de seguridad y los permisos efectivos del almacenamiento.

No se declara cumplimiento ASVS, certificación OWASP, análisis de dependencias, ejecución de pruebas ni ausencia absoluta de vulnerabilidades. Las verificaciones pendientes de la sección 11 son necesarias antes de considerar el riesgo residual aceptable para uso local.
