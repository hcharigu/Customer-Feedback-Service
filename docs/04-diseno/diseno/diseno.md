# Diseño fullstack — Customer Feedback Service

## 1. Propósito y fuentes

Este diseño concreta el cambio mínimo para una aplicación local donde:

- Un cliente envía una entrada de feedback.
- Un administrador funcional revisa las entradas almacenadas.
- La aplicación persiste los datos localmente.
- Frontend y backend se integran mediante una API HTTP local.
- Se incluyen puntos de diseño para validación, pruebas, accesibilidad y seguridad.

### Fuentes consideradas

- Brief original: aplicación pequeña para envío y revisión de feedback, con persistencia, validación, pruebas automatizadas y documentación local.
- Contexto inicial, fuente `1834315390987808`: no añadir autenticación, cloud, servicios externos ni integraciones externas.
- `analisis.md`: define el alcance fullstack, identifica la ausencia de repositorio y stack, y conserva las restricciones funcionales y de seguridad.

No se proporcionaron repositorio, estructura existente, framework, Figma, capturas, rutas actuales ni contrato anterior. Por ello, las rutas y contratos descritos aquí son decisiones mínimas de implementación; los nombres concretos de archivos deberán adaptarse a las convenciones del stack que se entregue.

---

## 2. Decisiones de diseño

| ID | Decisión | Justificación |
|---|---|---|
| DD-001 | Una entrada de feedback contiene exclusivamente `message`, `id` y `createdAt`. | Es el modelo mínimo que cumple el brief sin solicitar datos personales ni inventar clasificación, contacto, puntuación o metadatos no pedidos. |
| DD-002 | `message` es obligatorio, texto plano tras normalizar espacios de extremos, con longitud entre 1 y 2000 caracteres. | Permite feedback útil, rechaza entradas vacías y limita el volumen persistido y procesado. |
| DD-003 | La API local tendrá `POST /api/feedback` y `GET /api/feedback`. | Es el contrato mínimo para crear y revisar entradas, consistente con la propuesta del análisis. |
| DD-004 | La revisión estará en una ruta frontend separada, `/admin`, y el formulario en `/`. | Hace explícitos ambos flujos sin añadir funciones administrativas ni complejidad de estado en una sola pantalla. La ruta no implica protección de acceso. |
| DD-005 | Las entradas se listan de más reciente a más antigua por `createdAt`; `id` actúa como desempate determinista. | La revisión funcional suele requerir ver lo último recibido primero y el orden determinista simplifica las pruebas. |
| DD-006 | No se incorpora paginación, filtrado, búsqueda, edición ni borrado. | El encargo exige una aplicación pequeña y no solicita esas capacidades. La ausencia de paginación es aceptable para el volumen local esperado. |
| DD-007 | La persistencia se encapsula tras un repositorio y se implementa mediante un archivo local gestionado por el backend. | Evita servicios externos y dependencias de infraestructura. El repositorio permite sustituir la técnica si el stack existente ya proporciona un mecanismo local compatible. |
| DD-008 | El contenido introducido por usuarios se trata siempre como texto, nunca como HTML. | Previene XSS almacenado al mostrar feedback en la vista de revisión. |
| DD-009 | “Administrador” es un actor funcional sin autenticación. | El contexto prohíbe explícitamente autenticación, sesiones, JWT y proveedores de identidad. |

---

## 3. Arquitectura y límites

```text
Navegador local
│
├─ Ruta "/"                    Ruta "/admin"
│  └─ FeedbackFormPage          └─ FeedbackReviewPage
│       │                              │
│       └──────── API client HTTP ─────┘
│                         │
└─────────────────────────┼──────────────────────────────
                          │ HTTP local: /api/feedback
                          ▼
Backend local
├─ Feedback controller / route handler
├─ Feedback validation
├─ Feedback service
└─ Feedback repository
         │
         ▼
Archivo de persistencia local
```

### Responsabilidades

| Componente | Responsabilidad | No responsabilidad |
|---|---|---|
| Página de envío | Componer el formulario, mostrar errores, estado de envío y confirmación. | Decidir la validez final de los datos o persistir directamente. |
| Formulario de feedback | Recoger `message`, ejecutar validación de usabilidad y solicitar la creación. | Renderizar contenido de otras entradas. |
| Cliente API | Encapsular `POST` y `GET`, convertir respuestas HTTP a resultados consumibles por la interfaz. | Contener lógica de presentación o acceso a archivo. |
| Página de revisión | Solicitar y representar carga, error, vacío y listado. | Modificar entradas o interpretar su contenido como HTML. |
| Handler HTTP | Interpretar petición/respuesta y delegar en validación y servicio. | Implementar el acceso directo a archivo. |
| Validador | Normalizar y validar el payload del contrato. | Generar respuestas HTTP o realizar escrituras. |
| Servicio | Crear entidad con identificador y marca temporal de servidor. | Conocer detalles de interfaz o formato de archivo. |
| Repositorio | Leer y añadir entidades persistidas localmente. | Aceptar payload HTTP sin validar. |

### Persistencia local

La decisión mínima es un archivo de datos local administrado exclusivamente por el backend, con una colección de entidades `Feedback`.

Requisitos del adaptador de persistencia:

1. Crear el almacenamiento vacío cuando aún no exista.
2. Leer una colección vacía si no hay entradas.
3. Añadir solo entidades ya validadas y completas.
4. Escribir de forma que una escritura incompleta no reemplace silenciosamente el archivo válido; se recomienda escribir un temporal y renombrarlo de forma atómica cuando el sistema de archivos lo permita.
5. Serializar las escrituras dentro del proceso para evitar pérdidas por dos solicitudes concurrentes.
6. Mantener el archivo fuera de los recursos públicos servidos por el frontend y fuera del control de versiones.
7. Exponer errores de almacenamiento al servicio sin filtrar ruta de archivo, contenido ni detalles internos al cliente.

El formato físico del archivo no forma parte del contrato público. Si se selecciona JSON, la forma esperada será un arreglo de entidades `Feedback`; no deben persistirse payloads inválidos, mensajes de error ni secretos.

---

## 4. Modelo de datos

### Entidad persistida y devuelta

```ts
interface Feedback {
  id: string
  message: string
  createdAt: string
}
```

| Campo | Origen | Reglas |
|---|---|---|
| `id` | Servidor | Identificador opaco generado en servidor. Se recomienda UUID v4 u otro identificador local criptográficamente aleatorio equivalente. No se acepta desde el cliente. |
| `message` | Cliente, validado por servidor | Texto plano normalizado con `trim()`, obligatorio, entre 1 y 2000 caracteres inclusive. |
| `createdAt` | Servidor | Marca temporal ISO 8601 UTC generada al crear la entidad. No se acepta desde el cliente. |

### Payload de creación

```ts
interface CreateFeedbackRequest {
  message: string
}
```

### Reglas de validación autoritativas

| Regla | Resultado |
|---|---|
| El cuerpo no es JSON válido. | `400` con error global estable. |
| El cuerpo no es un objeto JSON. | `400` con error global estable. |
| Falta `message`. | `400` con error de campo `message`. |
| `message` no es `string`. | `400` con error de campo `message`. |
| `message.trim()` queda vacío. | `400` con error de campo `message`. |
| `message.trim()` supera 2000 caracteres. | `400` con error de campo `message`. |
| Se incluyen propiedades distintas de `message`. | `400` con error global estable. |
| El cuerpo excede 8 KiB antes de procesarse. | `400` con error global estable. |

La validación de cliente reproduce las reglas de presencia, tipo textual, espacios y longitud para ofrecer respuesta inmediata. No sustituye la validación de backend.

---

## 5. Contrato API

### Convenciones

- Base local: mismo origen que sirve la aplicación o la dirección local documentada por el stack.
- Formato de intercambio: `application/json; charset=utf-8`.
- Las respuestas de errores no incluyen trazas, rutas locales, consultas, secretos ni detalles del almacenamiento.
- Los campos de usuario se devuelven como cadenas de texto; la interfaz debe renderizarlos mediante mecanismos de escape propios del framework.

### Crear feedback

`POST /api/feedback`

#### Solicitud válida

```json
{
  "message": "La navegación fue clara y el formulario fue sencillo de usar."
}
```

#### Respuesta `201 Created`

```json
{
  "data": {
    "id": "f54f2e5a-1b8e-4b9b-86a7-2a2205046f53",
    "message": "La navegación fue clara y el formulario fue sencillo de usar.",
    "createdAt": "2026-10-06T12:00:00.000Z"
  }
}
```

#### Respuesta `400 Bad Request`: error de campo

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Revisa los datos enviados.",
    "fields": {
      "message": "Escribe un comentario de entre 1 y 2000 caracteres."
    }
  }
}
```

#### Respuesta `400 Bad Request`: error global

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "La solicitud no tiene un formato válido."
  }
}
```

#### Respuesta `500 Internal Server Error`

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "No se pudo guardar el feedback. Inténtalo de nuevo."
  }
}
```

### Listar feedback

`GET /api/feedback`

#### Respuesta `200 OK`

```json
{
  "data": [
    {
      "id": "f54f2e5a-1b8e-4b9b-86a7-2a2205046f53",
      "message": "La navegación fue clara y el formulario fue sencillo de usar.",
      "createdAt": "2026-10-06T12:00:00.000Z"
    }
  ]
}
```

`data` es siempre un arreglo, incluso sin resultados:

```json
{
  "data": []
}
```

El arreglo se ordena por `createdAt` descendente y, si dos valores coinciden, por `id` descendente.

#### Respuesta `500 Internal Server Error`

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "No se pudo cargar el feedback. Inténtalo de nuevo."
  }
}
```

### Matriz de integración

| Acción de interfaz | Llamada | Resultado esperado |
|---|---|---|
| Enviar formulario válido | `POST /api/feedback` | La confirmación muestra que el feedback fue guardado; el formulario se restablece. |
| Enviar formulario inválido localmente | Ninguna llamada | Se muestran errores asociados al campo y se conserva el texto introducido. |
| Recibir `400` del servidor | `POST /api/feedback` | Se muestran errores de `fields.message` cuando existan; el resto se comunica como error global. |
| Abrir revisión | `GET /api/feedback` | Se muestra carga y después lista o estado vacío. |
| Fallar la carga | `GET /api/feedback` | Se muestra un error seguro y un control para reintentar. |

---

## 6. Interfaz y navegación

No hay Figma ni capturas disponibles; no se definen medidas, tipografías, paleta ni componentes visuales que no estén sustentados por una fuente. El diseño se limita a estructura, estados y semántica.

### Navegación global

Una navegación simple y persistente enlaza:

- **Enviar feedback** → `/`
- **Revisar feedback** → `/admin`

La etiqueta “Revisar feedback” evita comunicar falsamente que la pantalla está protegida. No se mostrará control de inicio de sesión, cierre de sesión ni indicadores de permisos.

### Página `/`: envío de feedback

```text
main
 ├─ h1: Enviar feedback
 ├─ texto breve de propósito
 ├─ FeedbackForm
 │   ├─ label: Comentario
 │   ├─ textarea[name="message"]
 │   ├─ texto de ayuda: máximo 2000 caracteres
 │   ├─ mensaje de error asociado a message, si aplica
 │   └─ botón submit: Enviar feedback
 └─ región de estado
     ├─ éxito: Feedback enviado correctamente.
     └─ error global: mensaje seguro y opción de reintento
```

#### Estados del formulario

| Estado | Comportamiento |
|---|---|
| Inicial | Textarea vacío, botón habilitado. |
| Error local | Errores visibles bajo el control afectado; no se realiza petición. |
| Enviando | Botón deshabilitado con texto “Enviando…”. El contenido no se elimina. |
| Éxito | Se limpia el textarea, se informa éxito en una región de estado y el foco permanece en un contexto útil, sin cambio de ruta automático. |
| Error de API | Se conserva el texto; se representan errores de campo conocidos o mensaje global seguro. |
| Error de red/inesperado | Se conserva el texto y se muestra mensaje de reintento no técnico. |

### Página `/admin`: revisión

```text
main
 ├─ h1: Revisar feedback
 ├─ FeedbackList
 │   ├─ estado de carga
 │   ├─ alerta de error y botón Reintentar
 │   ├─ estado vacío
 │   └─ lista de FeedbackItem
 │       ├─ mensaje en texto plano
 │       └─ fecha de creación legible
```

#### Estados de revisión

| Estado | Comportamiento |
|---|---|
| Cargando | Texto perceptible “Cargando feedback…”. |
| Vacío | Texto “Todavía no hay feedback enviado.” |
| Con datos | Lista ordenada de entradas; cada una muestra mensaje y fecha. |
| Error | Mensaje seguro de carga y botón “Reintentar”, que vuelve a solicitar `GET /api/feedback`. |

Las fechas se presentan con formato local legible en la interfaz, manteniendo `createdAt` ISO 8601 en el contrato. Si una fecha persistida no puede representarse, la interfaz no debe romper el listado; mostrará un texto de fecha no disponible y el defecto se tratará como problema de integridad local.

### Componentes frontend mínimos

| Componente | Props o dependencias principales | Función |
|---|---|---|
| `AppNavigation` | Ruta actual | Enlaces entre envío y revisión. |
| `FeedbackFormPage` | Cliente API | Pantalla de envío y coordinación de estados. |
| `FeedbackForm` | `onSubmit`, estado, errores | Campo `message` y envío semántico. |
| `FormFieldError` | `id`, `message` | Error asociado programáticamente al campo. |
| `StatusMessage` | tipo, mensaje | Región reutilizable para éxito, carga o error. |
| `FeedbackReviewPage` | Cliente API | Solicitud inicial, reintento y composición de lista. |
| `FeedbackList` | `items`, estado, `onRetry` | Estados de carga, vacío, error y lista. |
| `FeedbackItem` | `feedback` | Renderizado textual seguro de una entrada. |
| `feedbackApi` | transporte HTTP | Operaciones `createFeedback` y `listFeedback`. |

No se requiere estado global: cada página controla el estado de su operación remota. El cliente API es compartido para centralizar la interpretación del contrato.

---

## 7. Accesibilidad

La interfaz deberá cumplir una base compatible con WCAG 2.1 A/AA para los flujos incluidos.

| Área | Diseño requerido |
|---|---|
| Semántica | Usar `main`, un único `h1` por pantalla, `form`, `label`, `textarea`, `button`, listas semánticas y enlaces reales para navegar. |
| Etiquetas | El `textarea` tendrá etiqueta visible asociada mediante `for`/`id` o mecanismo equivalente del framework. El placeholder no sustituye a la etiqueta. |
| Errores | Ante error de `message`, añadir `aria-invalid="true"` y enlazar el control con el mensaje mediante `aria-describedby`. |
| Estado asíncrono | Éxito, carga y errores se anuncian en una región apropiada, por ejemplo `role="status"` para confirmaciones/carga y `role="alert"` para errores relevantes. |
| Teclado | Enlaces, textarea, botón de envío y botón de reintento deben ser operables por teclado y conservar foco visible. |
| Color | Éxito, error y requerido usan texto e iconografía o estructura adicional; nunca solo color. |
| Contenido de usuario | `FeedbackItem` imprime el mensaje como nodo de texto. No se permite una API equivalente a `innerHTML` o HTML sin sanear. |
| Contraste y zoom | Los estilos del stack final deben conservar contraste AA y legibilidad al 200 % de zoom; no existe referencia visual para fijar colores en esta fase. |

---

## 8. Diseño de pruebas

Las herramientas se elegirán según el stack no proporcionado. La matriz siguiente define comportamiento comprobable y no presupone un framework concreto.

### Pruebas unitarias

| Unidad | Casos mínimos |
|---|---|
| Validador de creación | Acepta texto entre 1 y 2000 caracteres tras normalización; rechaza ausencia, tipos no texto, vacío, solo espacios, más de 2000 caracteres y propiedades adicionales. |
| Servicio de creación | Genera `id` y `createdAt` en servidor; envía al repositorio únicamente entidad validada. |
| Repositorio | Lee vacío en almacenamiento inicial; guarda y recupera entidad; conserva orden definido o permite al servicio ordenarlo de forma determinista; propaga fallo controlado de E/S. |
| Cliente API | Convierte `201` a entidad, interpreta `400` como error de validación y convierte fallos inesperados a error seguro de interfaz. |
| Formulario | No envía datos localmente inválidos; muestra error de campo; deshabilita el envío durante petición; conserva el texto ante error remoto; se limpia tras éxito. |
| Lista de revisión | Representa carga, vacío, datos y error; renderiza el mensaje como texto. |

### Pruebas de integración API

| Escenario | Preparación | Resultado esperado |
|---|---|---|
| Crear válido | Almacenamiento temporal vacío. | `POST` devuelve `201` y entidad con `id`, `message` normalizado y `createdAt`. |
| Crear inválido | Payload ausente, vacío, sobredimensionado o con campos no permitidos. | `400`, esquema de error estable y cero nuevas entradas persistidas. |
| Listar vacío | Almacenamiento temporal sin datos. | `GET` devuelve `200` y `data: []`. |
| Listar tras creación | Crear una o más entradas válidas. | `GET` devuelve todas las entidades persistidas en orden descendente definido. |
| Error de almacenamiento | Repositorio simulado con fallo. | `500` con mensaje genérico, sin detalles internos. |

Las pruebas de integración deben usar una ubicación de datos temporal aislada; no pueden modificar el archivo local de desarrollo.

### Pruebas E2E

| ID | Flujo | Criterio observable |
|---|---|---|
| E2E-001 | Envío válido y revisión posterior | El usuario escribe un mensaje válido, recibe confirmación, navega a `/admin` y observa el mismo mensaje. |
| E2E-002 | Validación de formulario | El usuario intenta enviar el formulario vacío y ve un error asociado al comentario sin confirmar envío. |
| E2E-003 | Estado vacío | Con almacenamiento E2E limpio, `/admin` muestra que todavía no hay feedback. |
| E2E-004 | Accesibilidad de flujo básico | El formulario puede completarse y enviarse por teclado; la etiqueta y el error del campo son identificables. |
| E2E-005 | Texto potencialmente hostil | Un mensaje con caracteres como `<script>alert(1)</script>` se muestra literalmente como texto y no crea nodos ejecutables. |

### Revisión de accesibilidad automatizada

Cuando el stack lo permita, las pruebas de componentes o E2E incorporarán una auditoría compatible con axe para `/` y `/admin`. Esta auditoría complementa, no sustituye, la comprobación de teclado, foco y anuncios de estado descrita arriba.

---

## 9. Revisión de seguridad aplicada al diseño

| Riesgo | Control de diseño | Cobertura |
|---|---|---|
| XSS almacenado | Mensajes se guardan y representan como texto; no se admite HTML de usuario. | `FeedbackItem`, pruebas unitarias/E2E. |
| Bypass de validación de cliente | Validación completa y autoritativa en backend antes de llamar al repositorio. | Handler, validador y pruebas API. |
| Payloads excesivos | Límite de cuerpo de 8 KiB y máximo de 2000 caracteres para `message`. | Configuración HTTP y validador. |
| Mass assignment | El request permite solo `message`; `id` y `createdAt` se generan en servidor. | Validador y contrato `POST`. |
| Fuga de información interna | Respuestas `500` genéricas; detalles de persistencia no se devuelven al navegador. | Handler de errores. |
| Escrituras concurrentes | Cola o exclusión de escrituras en el repositorio y reemplazo seguro del archivo. | Adaptador de persistencia. |
| Acceso no restringido a revisión | Se documenta como consecuencia conocida: `/admin` no está autenticada por restricción explícita del contexto. | Navegación y documentación. |
| Datos sensibles en feedback | Se limita el modelo a un comentario, no se piden datos de contacto y no se registra el contenido completo en errores. | Modelo, documentación y manejo de errores. |

No se añadirá autenticación, autorización, analítica, CDN, almacenamiento cloud, bases de datos administradas, correo, webhooks ni dependencias operativas externas.

---

## 10. Documentación que debe acompañar la implementación

La documentación final del repositorio deberá reflejar el stack real y cubrir:

1. Prerrequisitos concretos de runtime y gestor de paquetes.
2. Instalación de dependencias.
3. Configuración local si existe, incluida la ubicación configurable del archivo de datos.
4. Comando de ejecución de desarrollo.
5. Comando de build.
6. Comando de inicio de la build local, si es distinto.
7. Comandos de pruebas unitarias, integración y E2E.
8. Ciclo de vida de la persistencia: ubicación, creación inicial y cómo reiniciar los datos locales.
9. Rutas funcionales `/` y `/admin`.
10. Limitación explícita: la ruta de revisión no tiene autenticación por requisito del encargo.
11. Contrato resumido de `POST /api/feedback` y `GET /api/feedback`.

No se publicarán comandos concretos en esta fase porque no se ha proporcionado el stack, gestor de paquetes ni scripts existentes.

---

## 11. Supuestos mínimos y riesgos pendientes

### Supuestos adoptados

| ID | Supuesto | Base |
|---|---|---|
| AS-004 | Un único comentario textual satisface la noción no especificada de “feedback”. | El brief no define campos adicionales; se elige el modelo mínimo. |
| AS-005 | La aplicación puede exponer dos rutas frontend locales, `/` y `/admin`. | El brief requiere dos flujos, pero no fija navegación; esta decisión mantiene ambos explícitos y pequeños. |
| AS-006 | El volumen local previsto permite listado sin paginación. | La aplicación debe ser pequeña y no se solicita paginación. |
| AS-007 | Un archivo local controlado por el backend es una persistencia aceptable si el repositorio no aporta una alternativa local existente. | Cumple persistencia local sin infraestructura externa. |

### Riesgos y tratamiento

| Riesgo | Impacto | Tratamiento |
|---|---|---|
| El stack existente impone rutas, nombres o convenciones diferentes. | Ajuste de la estructura de implementación. | Conservar comportamiento, contrato y límites; adaptar únicamente nombres y ubicación de módulos. |
| El archivo local puede no ser adecuado para alto volumen o múltiples procesos. | Posibles conflictos y degradación. | Está aceptado para el alcance pequeño y local; no ampliar a infraestructura externa sin un cambio explícito de alcance. |
| La falta de autenticación permite que cualquier usuario local acceda a `/admin`. | Confidencialidad limitada. | Mantenerlo visible en la documentación; no implementar un mecanismo prohibido. |
| Los límites de 2000 caracteres y 8 KiB no proceden del brief. | Posible ajuste funcional futuro. | Se declaran como decisión mínima para validar y proteger el servicio; cualquier cambio deberá actualizar API, UI y pruebas. |
| No existe política de retención de datos. | Datos locales podrían mantenerse indefinidamente. | Documentar la ubicación y el reinicio manual del archivo; no inventar borrado automático no solicitado. |

---

## 12. Trazabilidad

| Requisito del análisis | Diseño que lo satisface | Prueba principal |
|---|---|---|
| RF-001: enviar feedback | `/`, `FeedbackForm`, `POST /api/feedback` | E2E-001 |
| RF-002: validación servidor | Validador autoritativo y respuestas `400` | Integración de creación inválida |
| RF-003: persistencia | Repositorio y archivo local | Integración crear y listar |
| RF-004: revisión | `/admin`, `FeedbackList`, `GET /api/feedback` | E2E-001 y E2E-003 |
| RF-005: integración frontend/API | `feedbackApi`, manejo de carga, éxito y error | Unitarias de cliente/formulario y E2E |
| RF-006: documentación local | Sección 10 | Revisión documental posterior |
| RNF-001: pequeño y local | Dos endpoints, dos páginas y archivo local | Revisión de dependencias y documentación |
| RNF-002: sin autenticación | No hay identidad, sesión ni control de acceso | Revisión de arquitectura |
| RNF-003: pruebas unitarias y E2E | Sección 8 | Suites del stack final |
| RNF-004: accesibilidad | Sección 7 | Prueba E2E de teclado y auditoría compatible |

Este diseño conserva el alcance mínimo: no incorpora funcionalidades de edición, eliminación, respuesta, adjuntos, puntuación, clasificación, búsqueda, filtrado, exportación, autenticación, cloud ni integraciones externas.
