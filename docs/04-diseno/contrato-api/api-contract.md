# Contrato API — Customer Feedback Service

## 1. Propósito y fuentes

Este documento define el contrato REST mínimo entre frontend y backend para el **Customer Feedback Service**. Cubre únicamente:

- Creación de una entrada de feedback.
- Consulta de las entradas persistidas para su revisión.
- Validaciones, respuestas de error y límites de seguridad asociados.

### Evidencia conservada

| Fuente | Hecho o decisión aplicable |
|---|---|
| Brief original | La aplicación permite enviar feedback y revisar entradas, con persistencia, validación, pruebas automatizadas y documentación local. |
| Contexto inicial, fuente `1834315390987808` | La solución debe ser pequeña, ejecutable localmente y no debe añadir autenticación, cloud, servicios ni integraciones externas. |
| `analisis/analisis.md` | El alcance es fullstack; el rol administrador es funcional y no implica autenticación. |
| `diseno/diseno.md`, DD-001 a DD-009 | El modelo mínimo contiene `id`, `message` y `createdAt`; el mensaje se valida y normaliza; se usan `POST /api/feedback` y `GET /api/feedback`; la revisión no tiene autenticación. |

No se proporcionó repositorio, stack, host local, framework HTTP ni contrato anterior. Por ello, esta especificación describe el protocolo HTTP/JSON y no presupone una implementación concreta.

---

## 2. Decisiones contractuales

| ID | Decisión | Base |
|---|---|---|
| AC-001 | El protocolo en alcance es REST sobre HTTP local con cargas y respuestas JSON UTF-8. | Alcance de contrato API y diseño DD-003. |
| AC-002 | La API se expone bajo `/api`; sus operaciones son `POST /api/feedback` y `GET /api/feedback`. | Diseño DD-003. |
| AC-003 | La creación acepta solamente `{ "message": string }`; `id` y `createdAt` son generados por servidor. | Diseño DD-001, DD-002 y revisión de mass assignment. |
| AC-004 | Tras eliminar espacios en extremos, `message` debe contener entre 1 y 2000 caracteres, ambos inclusive. | Diseño DD-002. |
| AC-005 | Las propiedades no declaradas en la creación son inválidas. | Diseño, validación autoritativa y control de mass assignment. |
| AC-006 | El listado devuelve todas las entradas sin paginación, ordenadas por `createdAt` descendente y `id` descendente como desempate. | Diseño DD-005 y DD-006. |
| AC-007 | Las respuestas de error usan una envoltura estable `error`; no revelan trazas, rutas locales, datos de almacenamiento ni otros detalles internos. | Análisis y diseño de seguridad. |
| AC-008 | La API no implementa autenticación ni autorización; `/admin` es una ruta de interfaz sin protección de identidad. | Contexto inicial y diseño DD-009. |
| AC-009 | El tamaño total del cuerpo de creación se limita a 8 KiB antes de procesarlo. | Diseño, revisión de seguridad. |

### Versionado

La versión inicial del contrato es `1.0.0`. Al no existir una política de versionado previa ni un consumidor externo conocido, se adopta el siguiente criterio mínimo:

- Los cambios compatibles, como añadir respuestas opcionales documentadas o campos opcionales de salida, incrementarán versión menor.
- Cambiar rutas, códigos de éxito, tipos de campos existentes, validaciones aceptadas o envolturas de respuesta será un cambio incompatible y requerirá versión mayor.
- Mientras la API sólo se ejecute localmente como parte de esta aplicación, el prefijo de ruta permanece en `/api` y la versión se comunica mediante `info.version`.
- Si se necesita coexistencia de versiones mayores, una decisión posterior deberá introducir un prefijo explícito, por ejemplo `/api/v2`, antes de publicar el cambio incompatible.

---

## 3. Resumen operativo

| Método | Ruta | Operación | Autenticación | Éxito | Errores principales |
|---|---|---|---|---|---|
| `POST` | `/api/feedback` | Crear y persistir una entrada validada. | No requerida ni implementada. | `201 Created` | `400`, `413`, `415`, `500` |
| `GET` | `/api/feedback` | Listar entradas persistidas para revisión. | No requerida ni implementada. | `200 OK` | `500` |

### Tipos principales

| Tipo | Uso | Campos |
|---|---|---|
| `CreateFeedbackRequest` | Cuerpo de `POST /api/feedback`. | `message` |
| `Feedback` | Entrada creada y persistida. | `id`, `message`, `createdAt` |
| `FeedbackResponse` | Éxito de creación. | `data: Feedback` |
| `FeedbackListResponse` | Éxito de listado. | `data: Feedback[]` |
| `ErrorResponse` | Cualquier respuesta de error. | `error.code`, `error.message`, opcionalmente `error.fields.message` |

---

## 4. Reglas de validación y comportamiento

### 4.1 Creación de feedback

| Condición recibida | Resultado HTTP | Código de error | Persistencia |
|---|---:|---|---|
| JSON objeto con sólo `message`, texto válido tras `trim()`. | `201` | No aplica. | Se genera y guarda una entidad. |
| JSON malformado. | `400` | `INVALID_REQUEST` | No se escribe nada. |
| Cuerpo JSON que no es un objeto. | `400` | `INVALID_REQUEST` | No se escribe nada. |
| Falta `message`. | `400` | `VALIDATION_ERROR` con `fields.message`. | No se escribe nada. |
| `message` no es una cadena. | `400` | `VALIDATION_ERROR` con `fields.message`. | No se escribe nada. |
| `message.trim()` está vacío. | `400` | `VALIDATION_ERROR` con `fields.message`. | No se escribe nada. |
| `message.trim()` supera 2000 caracteres. | `400` | `VALIDATION_ERROR` con `fields.message`. | No se escribe nada. |
| Hay una propiedad adicional, incluido `id` o `createdAt`. | `400` | `INVALID_REQUEST` | No se escribe nada. |
| El cuerpo supera 8 KiB antes de su procesamiento. | `413` | `PAYLOAD_TOO_LARGE` | No se escribe nada. |
| `Content-Type` no representa JSON. | `415` | `UNSUPPORTED_MEDIA_TYPE` | No se escribe nada. |
| Falla inesperada al guardar. | `500` | `INTERNAL_ERROR` | No se comunica información interna. |

La normalización `trim()` se aplica en el backend antes de crear y persistir la entidad. El valor devuelto en `Feedback.message` es el texto normalizado.

La validación equivalente de frontend es una mejora de usabilidad; el backend mantiene siempre la validación autoritativa.

### 4.2 Consulta de feedback

- `GET /api/feedback` no acepta parámetros de consulta, filtros ni paginación.
- Una colección vacía devuelve `200 OK` con `data: []`.
- La colección se ordena por `createdAt` descendente; si dos elementos tienen la misma fecha, se ordenan por `id` descendente.
- Si la lectura local falla inesperadamente, se responde `500 INTERNAL_ERROR` sin detalles de almacenamiento.

### 4.3 Autenticación y autorización

No existe esquema de autenticación, cabecera de credenciales, sesión, JWT, API key ni autorización basada en roles.

Esta ausencia es una restricción explícita del encargo, no una omisión accidental. Cualquier usuario con acceso a la aplicación local puede solicitar el listado. La interfaz deberá describir la ruta como **“Revisar feedback”** y no comunicar falsamente que está protegida.

---

## 5. Especificación OpenAPI 3.0.3

```yaml
openapi: 3.0.3
info:
  title: Customer Feedback Service API
  version: 1.0.0
  description: |
    API REST local para crear y revisar entradas de feedback.

    No incluye autenticación ni autorización por una restricción explícita
    del alcance. Las entradas se persisten localmente por el backend.
  license:
    name: UNLICENSED

servers:
  - url: /
    description: Mismo origen local que sirve la aplicación.

security: []

tags:
  - name: Feedback
    description: Creación y consulta de entradas de feedback.

paths:
  /api/feedback:
    post:
      tags:
        - Feedback
      summary: Crear una entrada de feedback
      description: |
        Valida y persiste una entrada de feedback local.

        Sólo se admite la propiedad `message`. El servidor elimina los espacios
        iniciales y finales, genera `id` y `createdAt`, y guarda únicamente la
        entidad validada. El cuerpo completo no puede superar 8 KiB.
      operationId: createFeedback
      security: []
      requestBody:
        required: true
        description: Cuerpo JSON con un comentario de texto plano.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateFeedbackRequest'
            examples:
              validFeedback:
                summary: Feedback válido
                value:
                  message: La navegación fue clara y el formulario fue sencillo de usar.
              trimmedFeedback:
                summary: El servidor normaliza espacios de extremos
                value:
                  message: "  El formulario fue rápido.  "
      responses:
        '201':
          description: Entrada creada y persistida correctamente.
          headers:
            Location:
              description: URI local de la colección de feedback creada.
              required: true
              schema:
                type: string
                example: /api/feedback
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FeedbackResponse'
              examples:
                createdFeedback:
                  summary: Entrada creada
                  value:
                    data:
                      id: f54f2e5a-1b8e-4b9b-86a7-2a2205046f53
                      message: La navegación fue clara y el formulario fue sencillo de usar.
                      createdAt: '2026-10-06T12:00:00.000Z'
        '400':
          description: Solicitud JSON inválida o datos que no cumplen el contrato.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                missingMessage:
                  summary: Falta el campo obligatorio
                  value:
                    error:
                      code: VALIDATION_ERROR
                      message: Revisa los datos enviados.
                      fields:
                        message: Escribe un comentario de entre 1 y 2000 caracteres.
                invalidProperties:
                  summary: Propiedades no permitidas
                  value:
                    error:
                      code: INVALID_REQUEST
                      message: La solicitud no tiene un formato válido.
                malformedJson:
                  summary: JSON malformado
                  value:
                    error:
                      code: INVALID_REQUEST
                      message: La solicitud no tiene un formato válido.
        '413':
          description: El cuerpo de solicitud supera el límite máximo de 8 KiB.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                payloadTooLarge:
                  value:
                    error:
                      code: PAYLOAD_TOO_LARGE
                      message: La solicitud supera el tamaño máximo permitido.
        '415':
          description: El tipo de contenido no es application/json.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                unsupportedMediaType:
                  value:
                    error:
                      code: UNSUPPORTED_MEDIA_TYPE
                      message: La solicitud debe enviarse como JSON.
        '500':
          $ref: '#/components/responses/InternalError'

    get:
      tags:
        - Feedback
      summary: Listar las entradas de feedback
      description: |
        Devuelve todas las entradas persistidas, incluidas las colecciones vacías.
        El orden es `createdAt` descendente y, ante igualdad, `id` descendente.
        No admite filtros, paginación ni parámetros de consulta.
      operationId: listFeedback
      security: []
      responses:
        '200':
          description: Lista de entradas de feedback, que puede estar vacía.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FeedbackListResponse'
              examples:
                populatedList:
                  summary: Colección con una entrada
                  value:
                    data:
                      - id: f54f2e5a-1b8e-4b9b-86a7-2a2205046f53
                        message: La navegación fue clara y el formulario fue sencillo de usar.
                        createdAt: '2026-10-06T12:00:00.000Z'
                emptyList:
                  summary: Colección vacía
                  value:
                    data: []
        '500':
          $ref: '#/components/responses/InternalError'

components:
  schemas:
    CreateFeedbackRequest:
      type: object
      description: |
        Solicitud de creación. No se permiten propiedades adicionales.
        La comprobación de longitud se aplica después de eliminar espacios
        iniciales y finales en el servidor.
      additionalProperties: false
      required:
        - message
      properties:
        message:
          type: string
          minLength: 1
          maxLength: 2000
          description: |
            Comentario de texto plano. Debe contener entre 1 y 2000 caracteres
            tras normalizar espacios de extremos.
          example: La navegación fue clara y el formulario fue sencillo de usar.

    Feedback:
      type: object
      additionalProperties: false
      required:
        - id
        - message
        - createdAt
      properties:
        id:
          type: string
          format: uuid
          description: Identificador opaco generado por el servidor.
          example: f54f2e5a-1b8e-4b9b-86a7-2a2205046f53
        message:
          type: string
          minLength: 1
          maxLength: 2000
          description: Comentario normalizado y tratado como texto plano.
          example: La navegación fue clara y el formulario fue sencillo de usar.
        createdAt:
          type: string
          format: date-time
          description: Marca temporal UTC ISO 8601 generada por el servidor.
          example: '2026-10-06T12:00:00.000Z'

    FeedbackResponse:
      type: object
      additionalProperties: false
      required:
        - data
      properties:
        data:
          $ref: '#/components/schemas/Feedback'

    FeedbackListResponse:
      type: object
      additionalProperties: false
      required:
        - data
      properties:
        data:
          type: array
          description: Entradas en orden descendente por createdAt y después por id.
          items:
            $ref: '#/components/schemas/Feedback'

    ErrorResponse:
      type: object
      additionalProperties: false
      required:
        - error
      properties:
        error:
          $ref: '#/components/schemas/ApiError'

    ApiError:
      type: object
      additionalProperties: false
      required:
        - code
        - message
      properties:
        code:
          type: string
          description: Código estable y apto para tratamiento programático.
          enum:
            - VALIDATION_ERROR
            - INVALID_REQUEST
            - PAYLOAD_TOO_LARGE
            - UNSUPPORTED_MEDIA_TYPE
            - INTERNAL_ERROR
        message:
          type: string
          description: Mensaje seguro destinado a la interfaz; no contiene detalles internos.
        fields:
          type: object
          description: |
            Errores de campos conocidos. Sólo se incluye para errores de validación
            asociados al campo message.
          additionalProperties: false
          properties:
            message:
              type: string
              example: Escribe un comentario de entre 1 y 2000 caracteres.

  responses:
    InternalError:
      description: Error inesperado del servidor o del almacenamiento local.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            persistenceFailure:
              value:
                error:
                  code: INTERNAL_ERROR
                  message: No se pudo completar la operación. Inténtalo de nuevo.
```

---

## 6. Integración frontend

### Cliente API mínimo

| Método de cliente propuesto | Solicitud | Respuesta esperada |
|---|---|---|
| `createFeedback(message)` | `POST /api/feedback` con `Content-Type: application/json` y `{ "message": string }`. | Convierte `201` en `Feedback`; convierte `400` en errores de formulario o globales; conserva el texto ante error. |
| `listFeedback()` | `GET /api/feedback`. | Convierte `200` en `Feedback[]`; permite distinguir colección vacía, error y carga. |

### Mapeo de respuestas a interfaz

| Respuesta API | Página o componente | Comportamiento requerido |
|---|---|---|
| `POST 201` | Formulario en `/`. | Limpiar el campo y anunciar “Feedback enviado correctamente.” |
| `POST 400` con `fields.message` | Formulario en `/`. | Asociar el mensaje al control `textarea[name="message"]`; marcarlo como inválido. |
| `POST 400` sin campos, `413`, `415` o `500` | Formulario en `/`. | Conservar el valor introducido y mostrar un error global textual seguro. |
| Error de red en `POST` | Formulario en `/`. | Conservar el valor y ofrecer reintento con un mensaje no técnico. |
| `GET 200` con `data: []` | Revisión en `/admin`. | Mostrar el estado vacío. |
| `GET 200` con datos | Revisión en `/admin`. | Renderizar cada `message` como texto, nunca como HTML. |
| `GET 500` o error de red | Revisión en `/admin`. | Mostrar error seguro y control “Reintentar”. |

El frontend no debe generar ni aceptar como editables `id` o `createdAt`. Los valores devueltos por la API son datos, no HTML; la representación debe usar el mecanismo de escape predeterminado del framework.

---

## 7. Seguridad aplicada al contrato

| Riesgo | Decisión contractual o de integración |
|---|---|
| XSS almacenado | `message` se define como texto plano. La API no acepta HTML como tipo especial y la interfaz debe insertarlo como nodo de texto, no mediante HTML sin sanear. |
| Mass assignment | `CreateFeedbackRequest` usa `additionalProperties: false`; `id` y `createdAt` no forman parte de la solicitud. |
| Bypass de validación cliente | Todas las reglas del apartado 4 se aplican en backend antes de persistir. |
| Cuerpo excesivo | El límite operativo de cuerpo es 8 KiB y el contrato comunica `413 PAYLOAD_TOO_LARGE`. |
| Fuga de detalles internos | Los errores se limitan a códigos y mensajes seguros; no incluyen trazas, rutas, consultas ni errores de E/S. |
| Acceso a revisión sin control | No se declara ni implementa seguridad; es una consecuencia explícita de la prohibición de autenticación. |
| Datos innecesarios | El contrato solicita sólo un comentario y no recopila nombre, correo, identidad, adjuntos ni metadatos no requeridos. |

No se definen límites de tasa, CORS para orígenes externos, webhooks, credenciales ni integraciones porque no forman parte del alcance local solicitado.

---

## 8. Trazabilidad a requisitos

| Requisito | Elementos del contrato | Comprobación esperada |
|---|---|---|
| RF-001: enviar feedback | `POST /api/feedback`, `CreateFeedbackRequest`, `FeedbackResponse`. | Una solicitud válida recibe `201` y el frontend muestra confirmación. |
| RF-002: validar antes de persistir | Reglas de sección 4.1; `400`, `413`, `415`; `ErrorResponse`. | Solicitudes inválidas devuelven el error especificado y no generan una entidad listable. |
| RF-003: persistencia | `POST` devuelve entidad creada y `GET` recupera la colección. | Tras crear una entrada válida, `GET` la devuelve posteriormente. |
| RF-004: revisar feedback | `GET /api/feedback`, `FeedbackListResponse`, arreglo vacío permitido. | La vista `/admin` representa carga, vacío, datos o error. |
| RF-005: integración frontend/API | Envolturas de éxito y error estables; tabla de integración de sección 6. | Cliente API interpreta los estados definidos sin depender de detalles de infraestructura. |
| RNF-001: solución pequeña y local | Dos operaciones, servidor relativo local y ausencia de integraciones externas. | Revisión de implementación y dependencias. |
| RNF-002: sin autenticación | `security: []`; no hay `securitySchemes`, `401` ni `403`. | Revisión de contrato e implementación: no hay credenciales, sesiones ni JWT. |
| RNF-003: pruebas automatizadas | Escenarios de sección 9. | Suites unitarias, integración y E2E del stack final. |
| RNF-004: accesibilidad base | Errores de campo estables y mapeables, más las reglas de UI de `diseno/diseno.md`. | Pruebas de asociación de error, teclado y estados perceptibles. |

---

## 9. Comprobaciones de consistencia definidas

Las siguientes comprobaciones son actividades requeridas para implementación, CI o revisión posterior. Este documento no afirma que hayan sido ejecutadas.

### 9.1 Consistencia del contrato

| ID | Comprobación | Resultado esperado |
|---|---|---|
| CC-001 | Validar la sintaxis y referencias de la sección OpenAPI con un validador compatible con OpenAPI 3.0.3. | La especificación es válida y todas las referencias `#/components/...` resuelven. |
| CC-002 | Revisar que no existan rutas, métodos, esquemas de seguridad ni operaciones fuera de `POST` y `GET /api/feedback`. | El contrato conserva el alcance mínimo y no introduce edición, borrado, autenticación ni integraciones. |
| CC-003 | Comparar el validador de backend con `CreateFeedbackRequest` y reglas semánticas descritas. | Sólo se acepta `message`; se rechazan propiedades adicionales; se aplica `trim()`, 1–2000 caracteres y límite de 8 KiB. |
| CC-004 | Comparar DTO o entidad de salida con `Feedback`. | Toda salida exitosa contiene únicamente `id`, `message` y `createdAt` con los tipos declarados. |
| CC-005 | Comprobar el orden del repositorio o servicio de listado. | Orden por `createdAt` descendente y `id` descendente como desempate. |
| CC-006 | Revisar los manejadores de error. | Ninguna respuesta expone detalles de archivos, trazas, secretos o errores internos. |
| CC-007 | Revisar el cliente frontend. | Envía JSON, interpreta `201`, `400`, `413`, `415`, `500` y fallos de red según sección 6. |
| CC-008 | Revisar la presentación de `message`. | No se usa una inserción HTML no saneada para contenido controlado por usuario. |
| CC-009 | Revisar rutas y configuración de seguridad. | No aparecen login, JWT, cookies de sesión, middleware de autenticación ni afirmaciones de acceso restringido. |

### 9.2 Casos de prueba contractuales

| ID | Tipo | Solicitud o condición | Resultado contractual |
|---|---|---|---|
| CT-001 | Integración API | `POST` con `{"message":"Comentario válido"}`. | `201`, `FeedbackResponse`, UUID, fecha ISO 8601 y mensaje normalizado. |
| CT-002 | Integración API | `POST` con `{"message":"  Comentario válido  "}`. | `201` y `data.message` igual a `Comentario válido`. |
| CT-003 | Integración API | `POST` con `{}`. | `400`, `VALIDATION_ERROR` y `fields.message`. |
| CT-004 | Integración API | `POST` con `{"message":"   "}`. | `400`, `VALIDATION_ERROR` y `fields.message`. |
| CT-005 | Integración API | `POST` con mensaje de 2001 caracteres tras normalizar. | `400`, `VALIDATION_ERROR` y `fields.message`. |
| CT-006 | Integración API | `POST` con `{"message":"válido","id":"forzado"}`. | `400`, `INVALID_REQUEST`; no se persiste la entrada. |
| CT-007 | Integración API | `POST` con JSON malformado. | `400`, `INVALID_REQUEST`. |
| CT-008 | Integración API | `POST` con cuerpo superior a 8 KiB. | `413`, `PAYLOAD_TOO_LARGE`. |
| CT-009 | Integración API | `POST` sin `Content-Type: application/json` o con tipo no JSON. | `415`, `UNSUPPORTED_MEDIA_TYPE`. |
| CT-010 | Integración API | `GET` sobre almacenamiento vacío. | `200` y `{ "data": [] }`. |
| CT-011 | Integración API | Crear dos o más entradas con fechas conocidas o reloj controlado y solicitar `GET`. | `200` con orden descendente por fecha e identificador. |
| CT-012 | Integración API | Simular fallo de escritura o lectura local. | `500`, `INTERNAL_ERROR`, sin detalle interno. |
| CT-013 | E2E | Enviar feedback válido desde `/` y abrir `/admin`. | Se confirma el envío y el mensaje se muestra en la revisión. |
| CT-014 | E2E/accesibilidad | Intentar enviar formulario vacío por teclado. | Error textual asociado al control; no se confirma envío. |
| CT-015 | E2E/seguridad | Crear el texto `<script>alert(1)</script>` y visualizarlo en revisión. | El texto se muestra literalmente; no se ejecuta ni se interpreta como HTML. |

---

## 10. Supuestos y actividades pendientes

### Supuestos mínimos adoptados

| ID | Supuesto | Base |
|---|---|---|
| AS-004 | Un único campo de comentario textual cubre el concepto no especificado de feedback. | `diseno/diseno.md`; se evita solicitar datos personales o añadir funcionalidades no pedidas. |
| AS-005 | Frontend y backend comparten origen local o se exponen bajo una dirección local documentada por el stack. | Alcance fullstack y servidor relativo de la especificación. |
| AS-006 | Un identificador UUID v4 o equivalente criptográficamente aleatorio está disponible en el runtime seleccionado. | Recomendación de diseño para identificadores opacos; el mecanismo exacto depende del stack. |
| AS-007 | El volumen previsto para una aplicación local pequeña permite devolver el listado completo sin paginación. | Diseño DD-006. |

### Pendientes de implementación o revisión

| ID | Actividad pendiente | Motivo |
|---|---|---|
| AP-001 | Adaptar la ubicación física del contrato y sus referencias a la estructura real del repositorio cuando se entregue. | No se proporcionó repositorio ni convenciones existentes. |
| AP-002 | Implementar el límite de cuerpo de 8 KiB en la capa HTTP antes del parseo del JSON. | OpenAPI describe el comportamiento, pero no configura el framework. |
| AP-003 | Implementar persistencia de archivo local fuera de recursos públicos y control de versiones, con escrituras serializadas y reemplazo seguro. | El formato y runtime no fueron proporcionados; es una decisión de diseño preservada. |
| AP-004 | Configurar una ubicación temporal aislada para integración y E2E. | Las pruebas no deben modificar los datos locales de desarrollo. |
| AP-005 | Ejecutar validación OpenAPI y las comprobaciones de consistencia de sección 9 en la fase de implementación/CI correspondiente. | Esta fase diseña el contrato; no dispone de herramientas ni de un proyecto ejecutable. |
| AP-006 | Documentar comandos concretos de instalación, ejecución, build y pruebas conforme al stack real. | El brief lo exige, pero no se han proporcionado runtime, gestor de paquetes ni scripts. |

---

## 11. Límites explícitos

Este contrato no incluye:

- Autenticación, autorización, usuarios, sesiones, JWT, API keys ni roles técnicos.
- Edición, eliminación, respuesta o moderación de feedback.
- Adjuntos, puntuaciones, categorías, búsqueda, filtrado, exportación o paginación.
- Cloud, almacenamiento administrado, correo, CRM, analítica, webhooks ni servicios externos.
- Datos de contacto, identificación personal o campos no solicitados.

Cualquier ampliación de esos límites requerirá actualizar este documento, la especificación OpenAPI, validaciones de backend, interfaz, persistencia y la matriz de pruebas correspondiente.
