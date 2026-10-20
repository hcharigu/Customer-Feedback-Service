# Plan de desarrollo — Customer Feedback Service

## 1. Propósito, fuentes y restricciones conservadas

Este plan organiza la implementación fullstack mínima definida en los entregables previos:

- `analisis/analisis.md`
- `diseno/diseno.md`
- `contrato-api/api-contract.md`

El objetivo es entregar una aplicación local pequeña donde un cliente envíe feedback y un administrador **funcional** pueda revisarlo.

### Restricciones obligatorias

- Mantener la solución pequeña y ejecutable localmente.
- Incluir persistencia local, validación, pruebas automatizadas, documentación e instrucciones de build y ejecución.
- No implementar autenticación, autorización, usuarios, sesiones, JWT, API keys ni roles técnicos.
- No usar cloud, SaaS, servicios externos ni integraciones externas.
- No añadir edición, borrado, respuestas, adjuntos, puntuaciones, categorías, filtros, búsqueda, exportación ni paginación.
- Renderizar el contenido proporcionado por usuarios exclusivamente como texto seguro.

### Supuesto mínimo de estructura

No se proporcionó árbol de repositorio, stack, gestor de paquetes ni scripts existentes. Por tanto, las rutas de módulos se indican por **responsabilidad** y deberán ubicarse según las convenciones del proyecto real. La única ruta de archivo confirmada para este entregable es `plan.md`.

---

## 2. Contrato que debe implementarse

La implementación debe respetar `contrato-api/api-contract.md` versión `1.0.0`.

| Operación | Contrato |
|---|---|
| Crear feedback | `POST /api/feedback` |
| Listar feedback | `GET /api/feedback` |
| Creación aceptada | Sólo `{ "message": string }` |
| Entidad devuelta | `{ id, message, createdAt }` dentro de `data` |
| Normalización | `message.trim()` antes de persistir y devolver |
| Longitud de mensaje | Entre 1 y 2000 caracteres inclusivos tras normalización |
| Cuerpo máximo | 8 KiB antes del procesamiento |
| Listado | Descendente por `createdAt` y, ante empate, por `id` |
| Persistencia | Archivo local controlado exclusivamente por backend |
| Error de validación | `400`, `VALIDATION_ERROR` o `INVALID_REQUEST` según contrato |
| Cuerpo excesivo | `413`, `PAYLOAD_TOO_LARGE` |
| Tipo de contenido incorrecto | `415`, `UNSUPPORTED_MEDIA_TYPE` |
| Error inesperado | `500`, `INTERNAL_ERROR`, sin detalles internos |

---

## 3. Orden de implementación

### Paso 1 — Inspeccionar y adaptar al stack real

**Componentes o archivos por confirmar**

- Manifiesto de dependencias y scripts del proyecto.
- Configuración de servidor, framework frontend y router existente.
- Configuración de pruebas unitarias, integración y E2E.
- Archivo de ignorados (`.gitignore` o equivalente).
- Documentación principal existente (`README.md` o equivalente).

**Acciones previstas**

1. Identificar runtime, framework, gestor de paquetes, convenciones de rutas y scripts ya disponibles.
2. Reutilizar dependencias de HTTP, UI, pruebas y build ya instaladas cuando satisfagan el alcance.
3. Confirmar la ubicación del archivo de persistencia local y garantizar que no sea un recurso público ni quede versionado.
4. Adaptar los nombres de módulos siguientes sin modificar el contrato ni las restricciones funcionales.

**Criterios de aceptación**

- El plan de archivos definitivo usa únicamente convenciones y herramientas realmente presentes en el repositorio.
- No se incorpora una dependencia operativa de autenticación, cloud, base de datos remota o servicio externo.
- La ubicación de datos de desarrollo, integración y E2E queda separada.

---

### Paso 2 — Implementar dominio, validación y persistencia backend

**Componentes previstos; rutas por confirmar**

| Componente | Responsabilidad |
|---|---|
| Tipo o modelo `Feedback` | Declarar `id`, `message` y `createdAt`. |
| DTO `CreateFeedbackRequest` | Representar exclusivamente `message`. |
| Validador de creación | Rechazar JSON no objeto, ausencia o tipo incorrecto de `message`, mensaje vacío tras `trim()`, mensaje mayor de 2000 caracteres y propiedades adicionales. |
| Servicio de feedback | Generar identificador opaco y marca ISO 8601 UTC; delegar la escritura sólo tras validar. |
| Repositorio de archivo local | Inicializar colección vacía, leer, añadir, serializar escrituras, escribir de forma segura y recuperar entradas. |
| Configuración de datos | Resolver la ruta local de datos por configuración local o valor seguro del proyecto, sin exponerla al navegador. |
| Archivo de ignorados | Excluir el archivo de datos local y temporales de pruebas. |

**Decisiones de implementación obligatorias**

1. El cliente no puede suministrar `id` ni `createdAt`.
2. El repositorio recibe entidades completas y validadas; no recibe directamente payloads HTTP.
3. Las escrituras deben serializarse en el proceso para evitar pérdida de actualizaciones concurrentes.
4. La escritura del archivo debe usar reemplazo seguro —por ejemplo, archivo temporal y renombrado— cuando el runtime lo permita.
5. El listado debe aplicar el orden `createdAt` descendente e `id` descendente como desempate.
6. Los errores de lectura o escritura se propagan internamente para que la capa HTTP los convierta en una respuesta genérica.
7. El contenido de `message` no se debe registrar íntegramente ante errores.

**Criterios de aceptación**

- Un mensaje válido con espacios extremos se guarda y devuelve normalizado.
- Las solicitudes inválidas no crean ni modifican entradas persistidas.
- Un almacenamiento inexistente se comporta como una colección vacía inicializable.
- El archivo de datos no se publica como recurso estático ni queda incluido en control de versiones.
- El backend puede recuperar las entradas creadas tras reiniciar la aplicación, sujeto a la conservación del archivo local.

---

### Paso 3 — Implementar API HTTP y manejo seguro de errores

**Componentes previstos; rutas por confirmar**

| Componente | Responsabilidad |
|---|---|
| Router o controlador de feedback | Exponer `POST /api/feedback` y `GET /api/feedback`. |
| Middleware o configuración de parser JSON | Exigir JSON y aplicar límite de 8 KiB antes del parseo. |
| Adaptador de errores HTTP | Convertir errores de validación, contenido, tamaño y persistencia en respuestas del contrato. |
| Registro de rutas API | Montar las rutas bajo `/api/feedback`. |

**Comportamiento previsto**

1. `POST /api/feedback` exige `Content-Type: application/json`.
2. JSON malformado, cuerpo no objeto o propiedades extra devuelven `400 INVALID_REQUEST`.
3. Reglas incumplidas de `message` devuelven `400 VALIDATION_ERROR` con `error.fields.message`.
4. Un cuerpo mayor a 8 KiB devuelve `413 PAYLOAD_TOO_LARGE`.
5. Tipo de contenido no JSON devuelve `415 UNSUPPORTED_MEDIA_TYPE`.
6. Un alta válida devuelve `201`, `Location: /api/feedback` y `FeedbackResponse`.
7. `GET /api/feedback` devuelve `200` con `{ "data": [] }` cuando no existen entradas.
8. Un fallo inesperado devuelve sólo el error genérico `INTERNAL_ERROR` definido en el contrato.

**Criterios de aceptación**

- Las formas de éxito y error coinciden con los esquemas de `contrato-api/api-contract.md`.
- Ninguna respuesta expone trazas, rutas de archivos, errores de E/S, secretos ni detalles de implementación.
- No existen endpoints de autenticación, modificación, borrado, filtrado ni paginación.
- `GET` no exige ni interpreta credenciales.

---

### Paso 4 — Implementar cliente API y tipos compartidos o equivalentes

**Componentes previstos; rutas por confirmar**

| Componente | Responsabilidad |
|---|---|
| Tipos de contrato de frontend | Representar `Feedback`, respuestas exitosas y errores API. |
| Cliente `feedbackApi` | Implementar `createFeedback(message)` y `listFeedback()`. |
| Normalizador de errores cliente | Distinguir error de campo, error global y fallo de red sin mostrar detalle técnico. |

**Acciones previstas**

1. Enviar `POST /api/feedback` con cuerpo JSON y cabecera `Content-Type: application/json`.
2. Interpretar `201` como entidad creada.
3. Interpretar `400` con `fields.message` como error asociado al formulario.
4. Tratar `400` sin campo, `413`, `415`, `500` y fallos de red como errores globales seguros.
5. Interpretar `GET 200` como una colección, incluso si está vacía.

**Criterios de aceptación**

- El frontend no genera ni permite editar `id` ni `createdAt`.
- El cliente no acopla la interfaz a rutas de archivos ni errores internos.
- Los mensajes se conservan en el formulario después de un fallo remoto o de red.

---

### Paso 5 — Implementar interfaz de envío en `/`

**Componentes previstos; rutas por confirmar**

| Componente | Responsabilidad |
|---|---|
| Ruta o página `/` | Mostrar el flujo de envío. |
| Navegación global | Enlazar “Enviar feedback” con `/` y “Revisar feedback” con `/admin`. |
| Formulario de feedback | Recoger y enviar `message`. |
| Error de campo | Asociar el error de `message` con el control. |
| Región de estado | Comunicar envío, éxito y fallo global. |

**Comportamiento previsto**

1. Presentar un `h1` “Enviar feedback”.
2. Usar un `form` semántico con `label` visible y `textarea[name="message"]`.
3. Informar que el máximo es 2000 caracteres.
4. Reproducir validación de cliente para vacío, espacios y longitud, sin sustituir el backend.
5. No emitir petición cuando la validación local falla.
6. Durante el envío, deshabilitar el botón y mostrar “Enviando…”.
7. Tras `201`, limpiar el textarea y anunciar “Feedback enviado correctamente.”.
8. Tras error API o red, conservar el texto y mostrar un mensaje seguro que permita reintento.

**Criterios de aceptación**

- El formulario puede completarse y enviarse con teclado.
- El control inválido usa `aria-invalid` y referencia el mensaje mediante `aria-describedby` o mecanismo equivalente.
- Éxito, carga y error no se comunican sólo mediante color.
- El foco visible se conserva y no existe redirección automática tras un envío correcto.

---

### Paso 6 — Implementar interfaz de revisión en `/admin`

**Componentes previstos; rutas por confirmar**

| Componente | Responsabilidad |
|---|---|
| Ruta o página `/admin` | Mostrar la revisión funcional de entradas. |
| Componente de listado | Gestionar carga, vacío, datos y error. |
| Elemento de feedback | Renderizar mensaje y fecha legible. |
| Botón de reintento | Reintentar `GET /api/feedback` después de un error. |

**Comportamiento previsto**

1. Presentar un `h1` “Revisar feedback”.
2. Solicitar `GET /api/feedback` al abrir la página.
3. Mostrar “Cargando feedback…” mientras la operación está pendiente.
4. Mostrar “Todavía no hay feedback enviado.” para una colección vacía.
5. Representar entradas en una lista semántica en el orden recibido.
6. Formatear `createdAt` de manera legible para la interfaz sin modificar el valor ISO del contrato.
7. Si una fecha local es ilegible, mostrar un texto de fecha no disponible sin bloquear el listado.
8. Ante fallo, mostrar mensaje seguro y botón “Reintentar”.

**Criterios de aceptación**

- La ruta `/admin` no declara ni simula protección de acceso.
- `message` se representa como nodo de texto escapado por el framework; no se usa HTML sin sanear, `innerHTML` ni equivalentes.
- Un mensaje como `<script>alert(1)</script>` aparece literalmente y no se ejecuta.
- La lista, el botón de reintento y la navegación son operables por teclado.

---

### Paso 7 — Añadir pruebas unitarias y de integración

**Componentes previstos; rutas por confirmar**

| Suite | Cobertura mínima |
|---|---|
| Unitarias de validador | Válido, recorte de espacios, ausente, no cadena, vacío, sólo espacios, 2001 caracteres y propiedades adicionales. |
| Unitarias de servicio | Generación de `id` y `createdAt`; repositorio llamado sólo con entidad válida. |
| Unitarias de repositorio | Inicialización vacía, guardado y lectura, ordenación o delegación de orden, propagación controlada de E/S. |
| Unitarias de cliente API | Éxito `201`, error de campo `400`, error global y red. |
| Unitarias de formulario | Validación local, asociación de error, bloqueo durante envío, conservación en fallo y limpieza en éxito. |
| Unitarias de listado | Carga, vacío, datos, error, reintento y renderizado textual. |
| Integración API | Casos CT-001 a CT-012 de `contrato-api/api-contract.md`. |

**Aislamiento de pruebas**

- Las pruebas de integración deben usar una ruta temporal independiente del archivo de desarrollo.
- Los identificadores, reloj y repositorio deben poder sustituirse o controlarse cuando el stack lo permita para comprobar orden y resultados deterministas.
- Las pruebas no deben requerir cloud, servicios remotos ni credenciales.

**Criterios de aceptación**

- Una creación inválida no puede aparecer posteriormente en el listado.
- Un alta válida puede recuperarse mediante `GET`.
- Se comprueban `400`, `413`, `415` y `500` conforme al contrato.
- Las respuestas de fallo simuladas no contienen información interna.

---

### Paso 8 — Añadir pruebas E2E, accesibilidad y seguridad

**Componentes previstos; rutas por confirmar**

| Prueba | Flujo verificable |
|---|---|
| E2E-001 | Envío válido en `/`, confirmación y posterior visualización en `/admin`. |
| E2E-002 | Envío vacío por teclado; error asociado al comentario y ausencia de confirmación. |
| E2E-003 | `/admin` con almacenamiento E2E limpio muestra estado vacío. |
| E2E-004 | Flujo básico navegable por teclado, con etiqueta y error identificables. |
| E2E-005 | Texto hostil se visualiza literalmente sin ejecución HTML. |
| Auditoría a11y compatible con el stack | Revisión automatizada de `/` y `/admin`, cuando la herramienta ya exista o se añada de forma local al proyecto. |

**Revisión manual de seguridad antes de cierre**

1. Verificar que `message` nunca se interpola como HTML.
2. Verificar que sólo se acepta la propiedad `message`.
3. Verificar que el límite de cuerpo se aplica antes de parsear JSON.
4. Verificar que las respuestas de error no filtran información interna.
5. Verificar que datos locales, temporales y artefactos de test están ignorados.
6. Verificar que no se añadieron dependencias, configuraciones o flujos de autenticación, cloud o integraciones externas.
7. Documentar expresamente que `/admin` es accesible sin autenticación por restricción del encargo.

**Criterios de aceptación**

- Los flujos E2E atraviesan interfaz, API y almacenamiento local aislado.
- La interacción básica por teclado funciona sin trampas de foco.
- La interfaz usa etiquetas, controles nativos, estados textuales y foco visible.
- La revisión de seguridad no identifica ejecución de contenido almacenado ni exposición de detalles internos.

---

### Paso 9 — Actualizar documentación y contrato publicado

**Archivos previstos**

| Archivo | Cambio previsto |
|---|---|
| `README.md` o documentación principal equivalente, ruta por confirmar | Instrucciones locales, arquitectura mínima, persistencia, rutas funcionales, limitaciones y pruebas. |
| `contrato-api/api-contract.md` | Mantenerlo sincronizado si la adaptación al stack requiere aclaraciones no incompatibles. |
| Archivo de ignorados, ruta por confirmar | Confirmar exclusión de datos locales y directorios temporales. |
| Configuración de ejemplo, sólo si el stack la necesita | Documentar ruta de datos local sin incluir datos reales ni secretos. |

**Contenido documental obligatorio**

1. Prerrequisitos reales de runtime y gestor de paquetes.
2. Instalación de dependencias.
3. Configuración local necesaria.
4. Comando de desarrollo.
5. Comando de build.
6. Comando para iniciar la build local, si difiere.
7. Comandos de pruebas unitarias, integración, E2E y auditoría de accesibilidad si aplica.
8. Ubicación, creación y reinicio del archivo de persistencia local.
9. Rutas `/` y `/admin`.
10. Resumen de `POST /api/feedback` y `GET /api/feedback`.
11. Limitación explícita: la revisión no tiene autenticación por requisito.
12. Límites explícitos: no cloud, servicios externos ni integraciones.

**Criterios de aceptación**

- La documentación no presupone infraestructura externa.
- Los comandos descritos corresponden a scripts y herramientas reales del repositorio.
- La documentación no afirma protección de `/admin`.
- El procedimiento para reiniciar datos locales no exige modificar código ni borrar recursos públicos.

---

## 4. Archivos y componentes afectados

Las rutas concretas siguen pendientes por ausencia de árbol de proyecto. La implementación deberá mapear los siguientes elementos a la estructura existente.

| Área | Archivos o componentes previstos |
|---|---|
| Backend | Modelo/DTO de feedback, validador, servicio, repositorio de archivo, configuración de persistencia, controlador/router, middleware de errores y límite JSON. |
| Frontend | Rutas `/` y `/admin`, navegación, formulario, estado de mensajes, cliente API, listado y elemento de feedback. |
| Pruebas | Unitarias backend, unitarias frontend, integración API con almacenamiento temporal, E2E y posible auditoría a11y. |
| Configuración | Scripts de pruebas, ruta temporal de datos, ignorados y configuración E2E según stack. |
| Documentación | Documento principal de ejecución local y `contrato-api/api-contract.md` si se requiere una corrección contractual compatible. |

---

## 5. Dependencias y compatibilidad

### Dependencias funcionales

| Dependencia | Decisión |
|---|---|
| Runtime y framework existentes | Deben determinar nombres, rutas y comandos definitivos. |
| Servidor HTTP local | Debe permitir JSON, límite de 8 KiB, códigos HTTP definidos y manejo centralizado de errores. |
| Sistema de archivos local | Debe permitir crear, leer y reemplazar de forma segura el archivo de datos. |
| Generador de UUID o aleatoriedad criptográfica equivalente | Debe estar disponible en el runtime o proceder de una dependencia local compatible. |
| Herramienta de pruebas existente | Debe cubrir unitarias, integración y E2E o configurarse conforme al stack real. |
| Auditoría de accesibilidad | Usar integración compatible con la herramienta de tests del proyecto cuando sea viable. |

### Dependencias prohibidas por alcance

- Servicios cloud y bases de datos administradas.
- APIs externas, CRM, correo, analítica, webhooks y notificaciones.
- Autenticación, autorización, identidad, sesiones, JWT y API keys.
- Dependencias destinadas a capacidades fuera de alcance, como búsqueda remota, colas, exportación o adjuntos.

---

## 6. Comandos de verificación aplicables

No se proporcionaron stack, gestor de paquetes ni scripts existentes. Por ello no es posible declarar comandos concretos y reales sin inventarlos. Tras la inspección del Paso 1, la documentación deberá completar esta tabla usando exclusivamente scripts disponibles en el manifiesto del proyecto.

| Finalidad | Comando real requerido | Resultado esperado |
|---|---|---|
| Instalar dependencias | **Por confirmar según gestor del repositorio** | Dependencias locales instaladas. |
| Desarrollo local | **Por confirmar según script existente** | Frontend y API locales disponibles. |
| Build | **Por confirmar según script existente** | Build local generada sin depender de cloud. |
| Pruebas unitarias | **Por confirmar según script existente** | Suites de validación, servicio, repositorio y componentes ejecutables. |
| Pruebas de integración API | **Por confirmar según script existente** | Casos CT-001 a CT-012 ejecutables con datos temporales. |
| Pruebas E2E | **Por confirmar según script existente** | Casos E2E-001 a E2E-005 ejecutables contra entorno local. |
| Auditoría de accesibilidad | **Por confirmar según herramienta compatible** | Auditoría automatizada de `/` y `/admin` cuando esté configurada. |
| Validación OpenAPI | **Por confirmar según validador ya presente o incorporado localmente** | Especificación OpenAPI 3.0.3 sin referencias inválidas. |

Estos comandos son actividades de verificación planificadas; este plan no afirma que hayan sido ejecutados.

---

## 7. Matriz de aceptación final

| Requisito | Evidencia planificada |
|---|---|
| Envío de feedback | Formulario en `/`, `POST /api/feedback`, prueba E2E-001. |
| Validación de servidor | Validador autoritativo, integración de errores `400`, `413` y `415`. |
| Persistencia local | Repositorio de archivo, prueba crear y listar con almacenamiento temporal. |
| Revisión de entradas | Ruta `/admin`, `GET /api/feedback`, estados de carga, vacío, datos y error. |
| Integración frontend/API | Cliente `feedbackApi`, pruebas de formulario, listado y E2E. |
| Pruebas automatizadas | Suites unitarias, integración y E2E definidas en este plan. |
| Documentación local | README o equivalente con comandos reales, datos locales, build y pruebas. |
| Sin autenticación | Ausencia de mecanismos de identidad; documentación explícita de acceso no protegido a `/admin`. |
| Sin cloud ni integraciones | Revisión de dependencias, configuración y documentación. |
| Accesibilidad base | Semántica, etiquetas, errores asociados, teclado, foco visible y estados textuales. |
| Seguridad | Escape de contenido, rechazo de propiedades adicionales, límite de cuerpo, errores seguros y datos ignorados. |

---

## 8. Riesgos concretos y mitigación

| Riesgo | Impacto | Mitigación planificada |
|---|---|---|
| El stack o repositorio existente difiere de la arquitectura prevista. | Las rutas y técnicas concretas pueden requerir adaptación. | Resolver primero el Paso 1; adaptar nombres y ubicación sin cambiar contrato ni restricciones. |
| El archivo local sufre escrituras concurrentes. | Pérdida o corrupción de datos. | Serializar escrituras y usar reemplazo seguro mediante temporal/renombrado cuando sea posible. |
| El archivo de datos termina servido públicamente o versionado. | Exposición de feedback local. | Ubicarlo fuera de recursos públicos y añadirlo al archivo de ignorados. |
| Persistencia por archivo no escala a múltiples procesos o alto volumen. | Conflictos o rendimiento insuficiente. | Se acepta sólo para el alcance local y pequeño; no ampliar a infraestructura externa sin cambio explícito de alcance. |
| Validación sólo en frontend. | Bypass mediante peticiones directas. | Repetir y hacer autoritativas todas las reglas en backend. |
| XSS almacenado. | Ejecución de contenido controlado por usuarios. | Renderizar `message` exclusivamente como texto y cubrirlo con prueba E2E-005. |
| Fuga de detalles internos en errores. | Exposición de rutas, E/S o implementación. | Centralizar respuestas de error y probar mensajes genéricos de `500`. |
| Falta de autenticación en `/admin`. | Cualquier usuario local puede ver entradas. | Mantenerlo como consecuencia explícita del brief; documentarlo sin implementar mecanismo prohibido. |
| Las decisiones de límite no proceden del brief. | Posibles cambios futuros de producto. | Mantener 2000 caracteres y 8 KiB según diseño y contrato; actualizar API, UI y pruebas juntos si cambian. |
| Las pruebas afectan datos de desarrollo. | Datos locales contaminados o eliminados. | Configurar almacenamiento temporal aislado para integración y E2E. |

---

## 9. Fuera de alcance confirmado

No se planifican cambios para:

- Login, logout, usuarios, permisos, sesiones, JWT, cookies de sesión o API keys.
- Despliegue, hosting, cloud, almacenamiento remoto, bases administradas o secretos de infraestructura.
- Correo, CRM, analítica, webhooks, notificaciones o integraciones de terceros.
- Edición, eliminación, moderación, respuesta, estado, adjuntos, comentarios, categorías o puntuaciones.
- Filtros, búsqueda, paginación, exportación o reportes.
- Recogida de nombre, correo, identidad u otros datos personales no solicitados.

Este plan es una planificación verificable y no confirma implementación, build, pruebas ni validaciones ejecutadas.
