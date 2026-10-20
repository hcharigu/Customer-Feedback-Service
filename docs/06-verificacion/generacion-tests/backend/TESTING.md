# Estrategia de pruebas — Customer Feedback Service

## Supuesto de ubicación

Los archivos de proyecto disponibles sitúan el servicio Node.js en `backend/`. Los comandos de este documento se ejecutan desde ese directorio. No se asume ni requiere ningún servicio externo.

## Suites y comandos

| Comando | Alcance | Datos |
|---|---|---|
| `npm test` | Unitarias de dominio, servicio, repositorio y cliente; integración HTTP del contrato. | Directorios temporales del sistema. |
| `npm run test:unit` | Reglas de dominio, servicio, repositorio y cliente API. | Directorios temporales cuando aplica. |
| `npm run test:integration` | Contrato HTTP `POST` y `GET /api/feedback`. | Archivo temporal aislado por caso. |
| `npm run test:ui` | Comportamiento unitario del cliente de interfaz: validación y conversión segura de respuestas. | Mocks de `fetch`. |
| `npm run test:e2e` | Navegador contra servidor local configurado por Playwright. | `data/e2e-feedback.json`, eliminado antes de la suite. |
| `npm run test:coverage` | Las suites Vitest con instrumentación V8 y reporte local. | Genera `coverage/`, ignorado por Git. |

La instalación de navegadores de Playwright se documenta en `README.md` mediante `npx playwright install`.

## Trazabilidad

| Criterio / caso contractual | Prueba |
|---|---|
| RF-001, envío válido y confirmación | E2E-001 en `e2e/feedback.spec.js`; creación `201` en integración. |
| RF-002, validación autoritativa y ausencia de persistencia inválida | Casos CT-003 a CT-009 en `tests/integration/feedback-api.contract.test.js`. |
| RF-003, persistencia local y recuperación | Repositorio unitario e integración de creación seguida de listado. |
| RF-004, revisión vacía y revisión con contenido | E2E-003 y E2E-001. |
| RF-005, cliente API y errores seguros | `tests/feedback-client.test.js`. |
| RNF-003, cobertura automatizada de flujos principales | Scripts `test`, `test:integration`, `test:ui`, `test:e2e` y `test:coverage`. |
| RNF-004, etiqueta, asociación de error y teclado | E2E-002/E2E-004. |
| Seguridad: asignación masiva | Unitarias de `validateCreateFeedback` y CT-006. |
| Seguridad: límite de carga | CT-008. |
| Seguridad: fuga de detalles internos | CT-012. |
| Seguridad: XSS almacenado | E2E-005 verifica representación literal y ausencia de scripts inyectados. |

## Límites conocidos de la automatización

- La auditoría automática completa con axe no está configurada: el manifiesto disponible no incluye una dependencia de auditoría de accesibilidad. Las pruebas E2E cubren los requisitos observables de etiqueta, asociación de error, estado textual y operación básica por teclado.
- Las pruebas no simulan varios procesos de servidor; el repositorio se prueba para escrituras concurrentes dentro del proceso, que es el alcance de su cola de escritura.
- La revisión de `/admin` no se prueba como ruta protegida porque, por requisito explícito, no incorpora autenticación ni autorización.
- Los resultados, porcentajes de cobertura y estado de ejecución no se declaran en este documento; dependen de la ejecución determinista de los comandos indicados.
