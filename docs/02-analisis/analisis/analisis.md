# Análisis fullstack — Customer Feedback Service

## 1. Fuentes y hechos confirmados

| Fuente | Hecho confirmado |
|---|---|
| Brief original | Se requiere una aplicación pequeña para que clientes envíen feedback y administradores revisen las entradas enviadas. |
| Brief original | Debe incluir persistencia, validación, pruebas automatizadas, documentación e instrucciones locales de build y ejecución. |
| Contexto inicial, fuente `1834315390987808` | La solución debe mantenerse pequeña y ejecutable localmente. |
| Contexto inicial, fuente `1834315390987808` | No se debe añadir autenticación, servicios cloud ni integraciones externas. |
| Alcance de ruta | Deben considerarse backend, frontend, contrato API, integración, pruebas unitarias, E2E y revisión de seguridad. |

No se han proporcionado repositorio, estructura de archivos, stack, contrato existente, diseño, modelo de datos, endpoints ni decisiones previas.

---

## 2. Objetivo

Implementar una aplicación fullstack local y de tamaño reducido que permita:

1. A un cliente enviar una entrada de feedback validada.
2. A un administrador revisar las entradas previamente enviadas.
3. Persistir las entradas entre ejecuciones de la aplicación.
4. Ofrecer documentación e instrucciones para compilar y ejecutar el proyecto de forma local.
5. Cubrir los flujos principales con pruebas automatizadas unitarias y E2E.

La expresión “administradores” describe el rol funcional de revisión; **no implica autenticación**, porque el contexto prohíbe añadirla.

---

## 3. Alcance funcional

### Incluido

- Formulario frontend para enviar feedback.
- Validación en cliente y servidor.
- API local para crear y consultar entradas de feedback.
- Persistencia local.
- Vista de revisión/listado para administradores.
- Estados de interfaz para carga, éxito, validación y error.
- Contrato API documentado.
- Pruebas unitarias de las reglas y validaciones.
- Pruebas de integración/API según el stack elegido.
- Pruebas E2E de envío y revisión.
- Documentación de instalación, build, ejecución y pruebas locales.
- Revisión de seguridad proporcional a una aplicación local sin autenticación.

### Excluido explícitamente

- Autenticación, autorización basada en identidad, sesiones, JWT o gestión de usuarios.
- Proveedores cloud.
- Servicios externos.
- Integraciones de correo, CRM, analítica, notificaciones o webhooks.
- Despliegue remoto.
- Paneles de administración externos.
- Funcionalidades no solicitadas, tales como edición, eliminación, respuesta al feedback, adjuntos, comentarios o clasificación automática.

---

## 4. Actores y flujos

| Actor funcional | Objetivo | Flujo observable |
|---|---|---|
| Cliente | Enviar feedback | Accede al formulario, completa los campos obligatorios, corrige errores si existen y recibe confirmación tras guardar el feedback. |
| Administrador | Revisar feedback enviado | Accede a la vista de revisión y consulta las entradas persistidas. |
| Sistema local | Proteger integridad del flujo | Rechaza solicitudes inválidas, persiste las válidas y devuelve respuestas predecibles sin revelar detalles internos. |

### Flujo de envío

1. El cliente abre la interfaz de envío.
2. Introduce los datos requeridos definidos por el contrato.
3. El frontend realiza validación de usabilidad sin reemplazar la validación de servidor.
4. El frontend solicita la creación del feedback mediante la API.
5. El backend valida la carga recibida.
6. Si la carga es válida, el backend crea la entrada con sus datos generados y la persiste.
7. El frontend muestra confirmación inequívoca.
8. Si existen errores de validación, se muestran por campo o de forma asociada al error correspondiente.
9. Si ocurre un fallo no validable, la interfaz muestra un mensaje seguro y permite reintento cuando proceda.

### Flujo de revisión

1. El administrador abre la vista de revisión.
2. El frontend solicita las entradas al endpoint de listado.
3. El backend devuelve las entradas persistidas.
4. La interfaz representa el estado de carga, un estado vacío si no existen datos y el listado si existen entradas.
5. Los valores textuales proporcionados por usuarios se renderizan como texto seguro, no como HTML ejecutable.

---

## 5. Requisitos trazables

> Los campos concretos, límites, orden de listado, paginación y formato exacto de persistencia no aparecen en el brief. No se fijan como requisitos cerrados en esta fase.

```yaml
requirements:
  - id: RF-001
    type: functional
    statement: La aplicación permitirá a un cliente enviar una entrada de feedback mediante una interfaz local.
    source: Brief original
    acceptance_criteria:
      - Un usuario puede completar el formulario y enviar una solicitud válida.
      - La interfaz confirma que la entrada fue guardada cuando la API responde con creación exitosa.
      - Una solicitud inválida no se presenta como enviada.

  - id: RF-002
    type: functional
    statement: El backend validará toda entrada de feedback antes de persistirla.
    source: Brief original
    acceptance_criteria:
      - La API rechaza datos que incumplan las reglas definidas por el contrato.
      - La respuesta de validación identifica los errores sin exponer internals del servidor.
      - Los datos inválidos no se persisten.

  - id: RF-003
    type: functional
    statement: La aplicación persistirá las entradas de feedback.
    source: Brief original
    acceptance_criteria:
      - Una entrada creada correctamente puede recuperarse posteriormente desde la vista de revisión.
      - La persistencia se ejecuta localmente y no requiere servicios cloud ni externos.

  - id: RF-004
    type: functional
    statement: La aplicación permitirá revisar las entradas de feedback enviadas.
    source: Brief original
    acceptance_criteria:
      - Existe una vista o ruta que obtiene las entradas mediante la API.
      - La vista informa cuando no existen entradas.
      - La vista representa las entradas recibidas sin interpretar el contenido de usuario como HTML.

  - id: RF-005
    type: functional
    statement: El frontend integrará el formulario y la vista de revisión con el contrato API implementado.
    source: Alcance de la ruta
    acceptance_criteria:
      - El envío usa el endpoint de creación definido.
      - La revisión usa el endpoint de consulta definido.
      - La interfaz gestiona carga, éxito y error de petición.

  - id: RF-006
    type: functional
    statement: El proyecto incluirá documentación e instrucciones para build y ejecución local.
    source: Brief original
    acceptance_criteria:
      - La documentación especifica prerrequisitos, instalación, configuración si existe, ejecución, build y pruebas.
      - Las instrucciones no requieren cloud, autenticación ni integraciones externas.

  - id: RNF-001
    type: non-functional
    statement: La solución se mantendrá pequeña y ejecutable localmente.
    source: Contexto inicial, fuente 1834315390987808
    acceptance_criteria:
      - No se introduce una dependencia operativa de cloud ni servicios externos.
      - El almacenamiento y los procesos necesarios para ejecutar la aplicación se describen localmente.

  - id: RNF-002
    type: non-functional
    statement: La solución no implementará autenticación.
    source: Contexto inicial, fuente 1834315390987808
    acceptance_criteria:
      - No se añaden flujos de inicio de sesión, credenciales, sesiones, JWT ni proveedores de identidad.
      - La documentación no declara protegida la vista de administrador.

  - id: RNF-003
    type: non-functional
    statement: El proyecto contará con pruebas automatizadas unitarias y E2E para los flujos principales.
    source: Brief original y alcance de la ruta
    acceptance_criteria:
      - Las pruebas unitarias cubren las reglas de validación y lógica de creación o persistencia aislable.
      - Las pruebas E2E cubren un envío válido y la posterior visualización en revisión.
      - Las pruebas contemplan al menos una entrada inválida.

  - id: RNF-004
    type: non-functional
    statement: La interfaz mantendrá accesibilidad base para el formulario y la revisión.
    source: Alcance frontend y guía WCAG de fase
    acceptance_criteria:
      - Los campos del formulario tienen etiquetas asociadas.
      - Los errores de validación son textuales y se asocian con el campo aplicable.
      - Los controles son operables mediante teclado.
      - Los estados de éxito y error son perceptibles sin depender únicamente del color.
```

---

## 6. Contrato API propuesto para concretar durante implementación

El brief exige integración y el alcance pide contrato API, pero no proporciona endpoints ni esquema. Se propone un contrato local mínimo, sujeto a validación de los campos pendientes:

| Operación | Método y ruta propuestos | Propósito | Respuestas mínimas |
|---|---|---|---|
| Crear feedback | `POST /api/feedback` | Validar y guardar una entrada | `201` creada; `400` error de validación; `500` error no esperado |
| Listar feedback | `GET /api/feedback` | Recuperar entradas para revisión | `200` listado; `500` error no esperado |

### Forma mínima de recursos

Los nombres definitivos de campos deben decidirse antes de codificar el contrato. Como mínimo, el recurso persistido requiere:

- identificador generado por servidor;
- contenido de feedback;
- marca temporal de creación;
- campos adicionales solamente si se acuerdan explícitamente.

### Reglas de contrato

- `POST` debe aceptar solamente el esquema definido.
- El servidor es la autoridad final para validar.
- `201` debe devolver la entrada creada o una representación inequívoca de su creación.
- `400` debe devolver un formato de error estable y apto para asociar errores con campos.
- `GET` debe devolver un arreglo —posiblemente vacío— de entradas.
- Las respuestas no deben revelar rutas internas, trazas, consultas, secretos ni detalles de implementación.

**Decisión pendiente:** no se puede fijar el esquema de solicitud, los límites de longitud ni el orden de respuesta porque el brief no los define.

---

## 7. Persistencia y arquitectura

### Hechos

- La persistencia es obligatoria.
- Debe ser local.
- No se permiten cloud ni servicios externos.
- El stack no está especificado.

### Inferencia técnica permitida

La implementación necesitará una solución de almacenamiento local incluida en el proyecto o ejecutable localmente. Una base de datos embebida o un almacenamiento de archivo controlado podrían satisfacer el requisito, siempre que se documente su ciclo de vida y se garantice la persistencia requerida.

Esta no es una decisión tomada: la elección depende del stack existente, que no fue suministrado.

### Límites de componentes previstos

```text
Frontend local
  ├─ Formulario de feedback
  └─ Vista de revisión
          │ HTTP local
Backend local
  ├─ Rutas/controladores API
  ├─ Validación y reglas de aplicación
  └─ Repositorio de persistencia local
          │
Almacenamiento local persistente
```

Se recomienda aislar la validación y el acceso a persistencia para permitir pruebas unitarias y de integración sin acoplar la interfaz a detalles de almacenamiento.

---

## 8. Plan de pruebas

| Capa | Cobertura esperada | Evidencia de aceptación |
|---|---|---|
| Unitarias backend | Validación de entradas válidas e inválidas; construcción de entidad; mapeo de errores; reglas de repositorio aislables. | Los casos inválidos no producen una entidad persistible y los válidos producen una representación consistente. |
| Unitarias frontend | Validación de formulario y renderizado de errores/estados, si el framework lo permite. | Los controles muestran feedback de validación y el envío no se dispara con datos localmente inválidos. |
| Integración API | `POST` válido, `POST` inválido, `GET` vacío y `GET` con datos persistidos. | Códigos HTTP y cuerpo ajustados al contrato final. |
| E2E | Cliente envía feedback válido; administrador lo ve en la revisión; usuario recibe error ante input inválido. | El flujo atraviesa frontend, API y persistencia local. |
| Accesibilidad | Etiquetas, navegación por teclado, foco visible, asociación de errores y estado perceptible. | Auditoría automatizada compatible con el stack y comprobación manual básica del flujo de teclado. |
| Seguridad | Rechazo de payload inválido; salida textual segura; manejo seguro de errores. | No se ejecuta contenido inyectado ni se revelan detalles internos en respuestas. |

Las herramientas de test concretas no se determinan: dependen del stack no proporcionado.

---

## 9. Revisión de seguridad proporcional al alcance

| Riesgo | Impacto | Medida requerida |
|---|---|---|
| XSS almacenado mediante feedback textual | El contenido enviado podría ejecutarse en la vista de revisión. | Renderizar contenido de usuario como texto escapado; no usar inyección de HTML sin sanitización explícita. |
| Validación solo en cliente | Puede persistirse contenido inválido mediante llamadas directas a la API. | Aplicar el mismo contrato y validación autoritativa en backend. |
| Mensajes de error con información interna | Exposición de implementación o datos sensibles. | Devolver errores genéricos para fallos internos y registrar detalles solo conforme al mecanismo local que determine el proyecto. |
| Cargas no previstas o demasiado grandes | Fallos de disponibilidad local o almacenamiento descontrolado. | Definir límites de tamaño por campo y límites de cuerpo de petición una vez decidido el esquema. |
| Sin autenticación en vista administrativa | Cualquiera con acceso a la aplicación local puede revisar entradas. | Mantener esta condición documentada como consecuencia explícita del requisito de no añadir autenticación; no afirmar control de acceso inexistente. |
| Exposición de datos persistidos | El feedback puede contener datos personales si los usuarios los introducen. | Solicitar únicamente campos necesarios, evitar secretos en logs y documentar la ubicación/retención de datos locales cuando se elija persistencia. |

No se identifican dependencias de seguridad externas permitidas, porque el contexto excluye servicios e integraciones externas.

---

## 10. Accesibilidad y experiencia mínima

Aplicar al menos WCAG 2.1 A/AA donde corresponda al formulario:

- Usar elementos semánticos (`form`, `label`, `button`, encabezados y regiones apropiadas).
- Asociar cada control a una etiqueta visible o accesible.
- Marcar los campos obligatorios según el contrato final.
- Exponer mensajes de validación mediante texto, asociaciones programáticas y un mecanismo perceptible por lectores de pantalla.
- Conservar foco visible y operación por teclado.
- No comunicar éxito, error o campos requeridos solo por color.
- Proveer estados de carga y ausencia de datos comprensibles.

No existe diseño visual adjunto; contraste, tipografía, breakpoints y componentes visuales específicos quedan pendientes de la implementación elegida.

---

## 11. Restricciones y dependencias

### Restricciones obligatorias

1. Aplicación pequeña.
2. Ejecución local.
3. Persistencia.
4. Validación.
5. Pruebas automatizadas.
6. Documentación e instrucciones de build y ejecución.
7. Sin autenticación.
8. Sin cloud.
9. Sin integraciones externas.

### Dependencias no provistas

- Repositorio y estado actual del código.
- Lenguaje, framework, gestor de paquetes y versiones.
- Motor o mecanismo de persistencia actual.
- Esquema de datos del feedback.
- Reglas concretas de validación.
- Diseño o rutas frontend existentes.
- Convenciones de API y formato de errores.
- Herramientas de test disponibles.
- Plataforma objetivo y versiones mínimas de runtime.

---

## 12. Vacíos reales y preguntas bloqueantes

| ID | Pregunta | Motivo |
|---|---|---|
| PB-001 | ¿Qué campos debe tener una entrada de feedback, cuáles son obligatorios y cuáles son sus límites/formato? | Impide cerrar el contrato `POST`, las validaciones y las pruebas de borde. |
| PB-002 | ¿Cuál es el stack y estructura del repositorio existente, si existe? | Impide citar archivos concretos, elegir librerías compatibles y formular instrucciones ejecutables reales. |
| PB-003 | ¿Qué almacenamiento local está permitido o preferido (base embebida, archivo u otro mecanismo local)? | La persistencia es obligatoria, pero no se ha definido su formato, migración ni ruta de datos. |
| PB-004 | ¿Cómo se espera ordenar las entradas en la revisión y si se necesita paginación? | Afecta contrato `GET`, comportamiento de interfaz y pruebas. |
| PB-005 | ¿La vista de revisión debe estar en una ruta/página separada o puede coexistir en una sola interfaz? | El brief requiere la capacidad funcional, no la navegación concreta. |
| PB-006 | ¿Existe una política de retención o sensibilidad de datos para el feedback persistido localmente? | Afecta el tratamiento de datos y la documentación de almacenamiento. |

Estas preguntas no se responden mediante conjeturas. Si no se resuelven, se debe adoptar y documentar un contrato mínimo explícito antes de implementar.

---

## 13. Supuestos mínimos declarados

```yaml
assumptions:
  - id: AS-001
    statement: “Administradores” representa una capacidad funcional de revisión y no un actor autenticado, porque el contexto prohíbe añadir autenticación.
    basis: Brief original y contexto inicial fuente 1834315390987808

  - id: AS-002
    statement: La aplicación usará comunicación HTTP local entre frontend y backend, pues el alcance exige contrato API e integración frontend-backend.
    basis: Alcance de la ruta

  - id: AS-003
    statement: La persistencia será local y no dependerá de infraestructura cloud ni de una integración externa.
    basis: Brief original y contexto inicial fuente 1834315390987808
```

---

## 14. Trazabilidad de implementación y aceptación

| Fuente | Requisito | Componente afectado | Prueba esperada |
|---|---|---|---|
| Brief original | RF-001 | Formulario frontend, `POST /api/feedback` | E2E de envío correcto. |
| Brief original | RF-002 | Validación de backend y mensajes frontend | Unitarias de validación e integración `POST` inválido. |
| Brief original | RF-003 | Repositorio y almacenamiento local | Integración: crear y recuperar tras persistir. |
| Brief original | RF-004 | Vista frontend, `GET /api/feedback` | E2E de revisión y estado vacío. |
| Alcance de ruta | RF-005 | Cliente API y manejo de estados UI | Pruebas de integración frontend/API. |
| Brief original | RF-006 | Documentación del repositorio | Revisión documental de prerrequisitos y comandos del stack real. |
| Contexto inicial | RNF-001, RNF-002 | Arquitectura, dependencias y documentación | Revisión de que no existan auth, cloud ni servicios externos. |
| Brief y alcance | RNF-003 | Configuración de pruebas y suites | Ejecución de suites unitarias, integración y E2E por fase posterior. |
| Alcance frontend | RNF-004 | Componentes y estilos UI | Auditoría automatizada y revisión manual de teclado. |

---

## 15. Decisiones conservadas para fases posteriores

1. No introducir autenticación, incluso para la vista denominada administrativa.
2. No incorporar cloud, SaaS ni integraciones externas.
3. Mantener el servicio y la interfaz deliberadamente pequeños.
4. Implementar persistencia estrictamente local.
5. No inventar campos, límites, esquema de datos ni stack: deben surgir de información adicional o de una decisión explícita documentada antes de implementación.
6. No considerar como incluidos edición, borrado, respuestas, adjuntos, filtrado, búsqueda, exportación ni paginación sin una ampliación del alcance.

## Conclusión

El encargo es claramente **fullstack**: exige formulario y revisión en frontend, API y persistencia en backend, contrato de integración y cobertura automatizada. Los requisitos principales son implementables dentro de una arquitectura local pequeña, pero el esquema de feedback y el stack son vacíos bloqueantes para producir cambios de código concretos y un contrato definitivo. La siguiente fase debe conservar las restricciones explícitas y registrar cualquier decisión mínima sobre campos, validaciones y almacenamiento antes de implementarla.
