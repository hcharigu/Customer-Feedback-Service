# Revisión de desarrollo — Customer Feedback Service

**Fase:** revision — Code review  
**Alcance revisado:** backend, frontend, contrato API, persistencia, integración y pruebas disponibles.  
**Naturaleza de la revisión:** estática/documental sobre los archivos entregados. No acredita build, ejecución de pruebas, auditoría dinámica ni análisis de dependencias.

## 1. Base de la revisión y supuesto de ruta

Se revisó como implementación principal `backend/`, dado que:

- `backend/README.md` documenta los comandos de ejecución.
- `generacion-tests/backend/TESTING.md` declara que el servicio Node.js está en `backend/`.
- Los informes previos de compilación y pruebas mencionan el contrato de scripts para `backend`.

También existen copias del servicio bajo `frontend/backend/` e `integracion/backend/`. No se consideran despliegues independientes en esta revisión, pero su coexistencia es un riesgo de mantenimiento descrito en las áreas no resueltas.

Requisitos y decisiones contrastados:

- Aplicación pequeña y ejecutable localmente.
- Formulario de envío en `/` y revisión funcional en `/admin`.
- `POST /api/feedback` y `GET /api/feedback`.
- Persistencia local, validación de servidor, pruebas unitarias, integración y E2E.
- Sin autenticación, cloud, servicios externos ni integraciones externas.
- El contenido de usuarios se debe presentar como texto seguro.
- Contrato `1.0.0` definido en `backend/contrato-api/api-contract.md`.

## 2. Resumen ejecutivo

| Estado | Cantidad | Resumen |
|---|---:|---|
| Hallazgos confirmados | 4 | Exposición potencial fuera de loopback sin autenticación, ausencia de cabeceras de privacidad/protección, crecimiento no acotado de persistencia y ausencia de validación de integridad de entidades ya almacenadas. |
| Brechas de evidencia | 2 | Las suites y el build están declarados, pero los recibos disponibles sólo contienen verificación estructural; no existe evidencia de ejecución satisfactoria. |
| Hipótesis / revisión pendiente | 4 | Dependencias bloqueadas, permisos efectivos, acceso de red real y coherencia de copias no son verificables de manera concluyente con los archivos aportados. |
| Controles positivos observados | 8 | Validación de payload, límite de cuerpo, protección contra mass assignment, renderizado seguro, errores genéricos, persistencia atómica intra-proceso, aislamiento de pruebas y documentación local. |

## 3. Hallazgos confirmados

### REV-001 — El proceso no restringe explícitamente la escucha a loopback pese a exponer lectura y escritura sin autenticación

- **Severidad:** Alta.
- **Ruta y componente:**
  - `backend/src/server.js`, inicialización final del servidor: `app.listen(port, ...)`.
  - `backend/src/app.js`, rutas `GET /api/feedback`, `POST /api/feedback` y entrega de `/admin`.
  - `backend/README.md`, secciones “Alcance” y “Rutas de interfaz”.
- **Evidencia:**
  - El servidor invoca `app.listen(port, ...)` sin host explícito.
  - La API permite listar todas las entradas mediante `GET /api/feedback`.
  - La interfaz entrega `/admin` sin autenticación.
  - La ausencia de autenticación es intencional y está documentada, conforme al brief.
- **Impacto:**
  - Si el runtime escucha en una interfaz accesible desde LAN, un túnel, proxy o un host compartido, cualquier cliente alcanzable puede leer todos los mensajes y crear entradas.
  - La falta de control de acceso no debe corregirse con autenticación, porque el alcance la prohíbe; debe contenerse por exposición de red.
- **Corrección concreta:**
  1. En `backend/src/server.js`, declarar explícitamente un host loopback, por ejemplo mediante una variable `HOST` con valor seguro `127.0.0.1`, y usar `app.listen(port, host, ...)`.
  2. Permitir sobrescribir el host sólo mediante una configuración local claramente documentada y con una advertencia explícita de que exponer el servicio por LAN o Internet revela `/admin` y la API.
  3. Actualizar `backend/README.md` para indicar que no se debe publicar mediante túneles, proxies o reenvíos de puertos mientras no exista una revisión de alcance que permita autenticación.
  4. Añadir una prueba o smoke test de configuración, si el entorno de pruebas lo permite, que compruebe la interfaz de escucha prevista.
- **Decisión de alcance preservada:** no introducir login, sesiones, JWT, API keys ni autorización.

---

### REV-002 — Las respuestas de feedback no establecen controles de no caché ni cabeceras defensivas de navegador

- **Severidad:** Media.
- **Ruta y componente:** `backend/src/app.js`, configuración global de Express, rutas API, `express.static(publicDirectory)` y entrega de `/admin`.
- **Evidencia:**
  - Sólo se observa `app.disable('x-powered-by')`.
  - No se observa configuración de:
    - `Cache-Control: no-store` para `GET /api/feedback`;
    - `X-Content-Type-Options: nosniff`;
    - `Referrer-Policy`;
    - `X-Frame-Options` o CSP con `frame-ancestors`;
    - `Permissions-Policy`;
    - una Content Security Policy compatible con los recursos propios.
- **Impacto:**
  - Los mensajes de feedback, que pueden contener información personal o sensible introducida libremente por usuarios, pueden permanecer en cachés del navegador o de intermediarios.
  - La interfaz puede ser embebida por otra página que alcance el servicio, facilitando interacción engañosa.
  - Una futura regresión de XSS tendría menor contención sin CSP, aunque el renderizado actual use `textContent`.
- **Corrección concreta:**
  1. Añadir middleware antes de las rutas y del contenido estático que configure, como mínimo:
     - `X-Content-Type-Options: nosniff`;
     - `Referrer-Policy: no-referrer`;
     - `X-Frame-Options: DENY` o una CSP con `frame-ancestors 'none'`;
     - una `Permissions-Policy` que deshabilite funcionalidades no utilizadas.
  2. En `GET /api/feedback`, establecer `Cache-Control: no-store`.
  3. Aplicar también `Cache-Control: no-store` a `/admin` y, si se considera sensible, a la página raíz.
  4. Definir una CSP de mismo origen compatible con `public/index.html`, `public/app.js`, `public/feedback-client.js` y `public/styles.css`; no habilitar orígenes externos que contradigan el alcance.
  5. Añadir pruebas de integración HTTP que comprueben estas cabeceras en `/`, `/admin` y `GET /api/feedback`.
- **Relación con el contrato:** no altera los cuerpos ni estados de `POST` y `GET`; es un endurecimiento compatible.

---

### REV-003 — La persistencia crece sin límite y el listado carga y ordena toda la colección en memoria

- **Severidad:** Media.
- **Ruta y componente:**
  - `backend/src/repositories/file-feedback-repository.js`, métodos `add()` y `list()`.
  - `backend/src/app.js`, `POST /api/feedback`.
  - `backend/contrato-api/api-contract.md`, definición de listado completo sin paginación.
- **Evidencia:**
  - `FileFeedbackRepository.add()` añade siempre una entidad al arreglo completo y vuelve a escribir el archivo JSON completo.
  - `FileFeedbackRepository.list()` carga todo el archivo y ejecuta `sort(compareFeedbackDescending)`.
  - No hay límite de número de entradas, tamaño total del archivo, retención ni cuota.
  - No hay rate limiting local.
  - El límite de 8 KiB por petición y 2000 caracteres por mensaje evita entradas individuales excesivas, pero no limita la acumulación.
- **Impacto:**
  - Un proceso que alcance el `POST` puede provocar crecimiento persistente del archivo, consumo de disco, degradación de CPU/memoria en `GET` y tiempos de reescritura crecientes.
  - El riesgo aumenta porque la API no tiene autenticación por una restricción válida del encargo.
- **Corrección concreta:**
  1. Definir y documentar un límite local compatible con el alcance pequeño: máximo de entradas, tamaño máximo de archivo o ambos.
  2. Antes de persistir, comprobar la cuota elegida y devolver un error seguro y estable cuando se exceda, sin filtrar rutas ni tamaños internos no documentados.
  3. Definir una política de retención y el procedimiento local de limpieza en `backend/README.md`.
  4. Añadir pruebas de integración para el límite: la entrada rechazada no debe persistirse, el archivo debe mantenerse legible y la respuesta no debe revelar detalles internos.
  5. Si el producto deja de ser de volumen pequeño, versionar el contrato antes de introducir paginación o un cambio de almacenamiento.
- **Supuesto mínimo:** esta recomendación no exige servicio externo, cloud ni base de datos remota; puede implementarse enteramente en el repositorio local.

---

### REV-004 — El repositorio valida que el archivo sea un arreglo, pero no valida que cada elemento cumpla el esquema `Feedback`

- **Severidad:** Media.
- **Ruta y componente:**
  - `backend/src/repositories/file-feedback-repository.js`, método privado `#readAll()`.
  - `backend/src/domain/feedback.js`, `compareFeedbackDescending()`.
  - `backend/src/app.js`, respuesta de `GET /api/feedback`.
- **Evidencia:**
  - `#readAll()` sólo comprueba `Array.isArray(parsed)`.
  - Cualquier arreglo JSON se considera almacenamiento válido, incluso si contiene valores no objeto o entidades sin `id`, `message` o `createdAt`.
  - `list()` ordena directamente mediante `compareFeedbackDescending()`, que espera que `createdAt` e `id` tengan `localeCompare`.
  - `GET /api/feedback` devuelve directamente el resultado del repositorio dentro de `{ data: feedback }`.
- **Impacto:**
  - Un archivo local alterado, truncado parcialmente en una forma JSON válida o escrito con un esquema antiguo puede provocar un `500` durante la ordenación o devolver elementos que incumplen el contrato de salida.
  - La recuperación funcional y la integridad del contrato quedan condicionadas al contenido físico del archivo, sin diagnóstico controlado ni estrategia clara de recuperación.
- **Corrección concreta:**
  1. Añadir un validador de entidad persistida, separado de `validateCreateFeedback`, que exija para cada elemento:
     - objeto no nulo y no arreglo;
     - `id` de tipo cadena no vacía;
     - `message` de tipo cadena y dentro de la longitud válida;
     - `createdAt` de tipo cadena con fecha ISO válida;
     - ausencia de propiedades no esperadas, si el formato físico se mantiene estricto.
  2. Ejecutar esta validación al leer el archivo antes de ordenar o devolver datos.
  3. Si el archivo no cumple el esquema, propagar un error interno para devolver el `500 INTERNAL_ERROR` ya definido, sin exponer contenido ni ruta.
  4. Documentar un procedimiento de recuperación local: conservar una copia del archivo corrupto para diagnóstico local y reinicializarlo sólo mediante una acción explícita del operador.
  5. Añadir pruebas unitarias del repositorio para arreglos con `{}`, campos ausentes, tipos inválidos y `createdAt` inválido.
- **Nota:** el uso actual de errores genéricos hacia el cliente reduce la fuga de información; el hallazgo afecta integridad y previsibilidad, no expone por sí mismo una traza.

## 4. Brechas confirmadas de evidencia y cobertura

### REV-005 — No existe recibo de ejecución de build, pruebas unitarias, integración ni E2E

- **Severidad:** Media para aceptación de entrega; no es un defecto funcional confirmado en tiempo de ejecución.
- **Rutas y evidencia:**
  - `compilacion/compilacion.md`: estado `unavailable`; `development-build` omitido.
  - `tests-unitarios/unit-tests.md`: estado `unavailable`; `development-unit-tests` omitido.
  - `tests-integracion/integration-tests.md`: estado `unavailable`; `development-integration-tests` omitido.
  - `tests-e2e/e2e.md`: estado `unavailable`; `development-e2e` omitido.
  - `backend/package.json`: declara `build`, `test`, `test:unit`, `test:integration`, `test:ui` y `test:e2e`.
- **Impacto:**
  - Hay suites y scripts implementados, pero no hay evidencia disponible de que resuelvan dependencias, arranquen el servidor, superen los casos contractuales o ejecuten Playwright con navegadores instalados.
  - No se puede acreditar que las correcciones o el código actual no tengan regresiones de runtime.
- **Corrección concreta:**
  1. El nodo de verificación posterior debe ejecutar desde `backend/` los scripts documentados:
     - `npm run build`;
     - `npm run test:unit`;
     - `npm run test:integration`;
     - `npm run test:ui`;
     - `npm run test:e2e`.
  2. Debe conservar recibos con comando, código de salida, duración y salida resumida.
  3. Si se usa `npm test` como suite consolidada, debe comprobarse que incluye las rutas definidas en `backend/vitest.config.js`.
- **Límite de esta revisión:** no se afirma resultado de esas actividades.

---

### REV-006 — No hay auditoría automática integral de accesibilidad y faltan pruebas unitarias de comportamiento DOM del formulario y listado

- **Severidad:** Baja.
- **Ruta y componente:**
  - `backend/package.json`, dependencias de desarrollo.
  - `backend/e2e/feedback.spec.js`.
  - `backend/tests/feedback-client.test.js`.
  - `generacion-tests/backend/TESTING.md`, sección “Límites conocidos de la automatización”.
- **Evidencia:**
  - No se observa una dependencia ni configuración de auditoría como axe.
  - Las pruebas del cliente cubren `feedback-client.js` y `localMessageError`, pero no montan ni verifican el DOM de `public/app.js`.
  - Las E2E disponibles cubren estado vacío, envío por teclado, asociación de `aria-describedby` y representación de texto hostil, pero no constituyen una auditoría WCAG automatizada.
  - `TESTING.md` declara expresamente que no está configurada una auditoría automática completa.
- **Impacto:**
  - Regresiones en regiones vivas, roles de alerta, foco visible, navegación, contraste o semántica del DOM pueden llegar a la entrega sin detección automatizada específica.
- **Corrección concreta:**
  1. Incorporar una auditoría local compatible con el stack para `/` y `/admin`, sin depender de un servicio externo.
  2. Añadir pruebas de interfaz DOM para al menos:
     - estado “Enviando…” y botón deshabilitado;
     - limpieza del formulario tras `201`;
     - conservación del contenido ante error remoto;
     - visibilidad y semántica del botón “Reintentar”;
     - cambio de `role="alert"` ante errores;
     - renderizado de fecha inválida.
  3. Conservar las E2E de teclado actuales como complemento, no como sustituto de la auditoría.
- **Observación positiva:** `backend/public/index.html` sí contiene etiqueta visible, controles nativos, enlace de salto y regiones `aria-live`; el hallazgo es de cobertura verificable, no una afirmación de incumplimiento WCAG.

## 5. Controles correctos observados

| Área | Evidencia revisada | Resultado estático |
|---|---|---|
| Contrato de creación | `backend/src/domain/feedback.js` acepta exclusivamente `message`, aplica `trim()` y valida 1–2000 caracteres. | Conforme con el contrato documentado. |
| Mass assignment | `Object.keys(payload)` exige exactamente la propiedad `message`. | `id`, `createdAt` y claves extra son rechazados. |
| Tamaño y tipo de cuerpo | `backend/src/app.js` usa `express.json({ limit: '8kb', type: 'application/json' })` y la ruta valida JSON. | Cubre `413` y `415` definidos. |
| Errores de parseo | Middleware final de `backend/src/app.js` convierte JSON malformado y exceso de tamaño en respuestas estables. | No se observan trazas devueltas al cliente. |
| Campos de servidor | `backend/src/services/feedback-service.js` genera `id` con `randomUUID()` y `createdAt` mediante reloj de servidor. | El cliente no controla esos campos. |
| XSS almacenado | `backend/public/app.js`, `renderFeedback()`, usa `message.textContent = feedback.message`. | No se observa `innerHTML` ni equivalente para el mensaje. |
| Escrituras locales | `backend/src/repositories/file-feedback-repository.js` serializa escrituras intra-proceso y emplea temporal más `rename`. | Reduce pérdidas por concurrencia dentro de un proceso. |
| Aislamiento de datos de pruebas | Tests de integración usan directorios temporales; E2E usa `data/e2e-feedback.json` y `global-setup.js` lo elimina antes de suite. | Diseño de aislamiento adecuado en el código de prueba. |
| Restricciones de alcance | No se observan autenticación, sesiones, JWT, cloud, webhooks, CRM ni integraciones externas. | Conforme con las restricciones del brief. |

## 6. Hipótesis y áreas no concluyentes

Estas observaciones no se clasifican como hallazgos confirmados porque requieren información o ejecución no disponible.

| Área | Estado | Evidencia / motivo | Acción posterior |
|---|---|---|---|
| Vulnerabilidades de dependencias | No revisable concluyentemente | `backend/package.json` usa rangos semver y no se aportó lockfile, árbol instalado, SBOM ni análisis de CVE. | Generar o aportar lockfile y revisar las versiones realmente instaladas con una herramienta local apropiada. |
| Permisos efectivos de datos | Parcialmente cubierto | El archivo nuevo usa modo `0o600`, pero no se verifican permisos de directorio, archivo existente, umask ni SO objetivo. | Comprobar permisos reales y endurecer creación de directorio/archivo según plataforma. |
| Exposición de red efectiva | Pendiente | La ausencia de host explícito es confirmada, pero firewall, proxy, túneles y red del host no están disponibles. | Verificar interfaces de escucha y reglas de firewall tras fijar loopback explícito. |
| Concurrencia entre procesos | Pendiente | `#writeQueue` sólo serializa operaciones de una instancia de `FileFeedbackRepository`. | Documentar ejecución de proceso único o introducir bloqueo adecuado si se permite más de un proceso. |
| Recuperación tras fallo de filesystem | Parcialmente revisada | Hay temporal y `rename`, pero no se observan pruebas para disco lleno, fallo de renombrado, archivo truncado o recuperación. | Añadir pruebas de errores de E/S y runbook de recuperación local. |
| Coherencia de copias de código | Riesgo de mantenimiento | Existen copias bajo `backend/`, `frontend/backend/` e `integracion/backend/`; varias rutas fueron emitidas por fases distintas según informes estructurales. | Declarar una única raíz canónica y eliminar o excluir copias no ejecutables para prevenir divergencia. |
| Contraste visual real | Pendiente | Hay estilos y foco visible, pero no hay medición automatizada ni revisión en navegador. | Ejecutar auditoría de accesibilidad y revisar contraste al 200 % de zoom. |

## 7. Orden recomendado de corrección y verificación posterior

1. **P0 — Contención local sin autenticación**
   - Corregir REV-001: escucha explícita en loopback y documentación de no exposición.
   - Corregir REV-002: `no-store` y cabeceras defensivas mínimas.

2. **P1 — Integridad y disponibilidad de persistencia**
   - Corregir REV-004: validar todas las entidades leídas del archivo.
   - Corregir REV-003: establecer cuota local, comportamiento al alcanzarla y política de retención.

3. **P1 — Evidencia de aceptación**
   - Ejecutar las suites declaradas y conservar resultados verificables.
   - Añadir pruebas de las nuevas cabeceras, cuota e integridad de archivo.

4. **P2 — Calidad y accesibilidad**
   - Corregir REV-006 con auditoría local de accesibilidad y pruebas DOM de estados críticos.
   - Resolver la raíz canónica del proyecto para evitar que una corrección se aplique sólo a una copia.

## 8. Conclusión

La implementación disponible satisface estáticamente el flujo principal definido: recibe feedback validado, genera campos de servidor, persiste localmente, lo lista en orden determinista y lo renderiza como texto seguro. La separación entre dominio, servicio, repositorio, API y cliente es proporcional al alcance.

Los riesgos prioritarios no provienen de autenticación faltante como defecto aislado —su ausencia es una restricción explícita—, sino de no contener técnicamente la exposición de una API de lectura y escritura sin autenticación. Antes de aceptar la entrega para uso local, deben limitarse la interfaz de escucha, la caché de respuestas, el crecimiento del archivo y la integridad de datos persistidos. La ejecución de build y suites permanece pendiente de evidencia determinista posterior.
