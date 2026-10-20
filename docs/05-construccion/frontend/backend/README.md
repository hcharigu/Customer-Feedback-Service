# Customer Feedback Service

Aplicación local pequeña para enviar feedback y revisar las entradas persistidas.

## Alcance

- Formulario de envío en `/`.
- Vista funcional de revisión en `/admin`.
- API local JSON bajo `/api/feedback`.
- Persistencia local en un archivo JSON.
- Validación en cliente y servidor.
- Pruebas unitarias, de integración HTTP y E2E.

No incluye autenticación, autorización, cuentas de usuario, cloud, servicios externos ni integraciones externas. Por este requisito, cualquier persona que pueda acceder a la aplicación local puede abrir `/admin`.

## Prerrequisitos

- Node.js 20 o superior.
- npm.
- Para E2E, los navegadores de Playwright instalados localmente.

## Instalación

```bash
npm install
npx playwright install
```

## Ejecución local

```bash
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`.

Para iniciar sin modo de observación:

```bash
npm start
```

## Build local

El proyecto sirve recursos estáticos sin un proceso de compilación de frontend. El comando de build valida que los recursos publicados necesarios existan y crea el directorio de distribución:

```bash
npm run build
```

## Pruebas

```bash
npm test
npm run test:e2e
```

`npm test` ejecuta pruebas unitarias y de integración HTTP con archivos temporales aislados. `npm run test:e2e` inicia un servidor local temporal mediante la configuración de Playwright y usa un archivo de datos E2E aislado.

## Persistencia local

Por defecto, el servidor guarda los datos en:

```text
data/feedback.json
```

El archivo se crea automáticamente con una colección vacía cuando se envía la primera entrada. Para usar otra ubicación local, defina `FEEDBACK_DATA_FILE`:

```bash
FEEDBACK_DATA_FILE=./data/otro-feedback.json npm start
```

Para reiniciar los datos de desarrollo, detenga el servidor y elimine `data/feedback.json`. El directorio `data/` está ignorado por Git y no se sirve como contenido estático.

## Rutas de interfaz

| Ruta | Propósito |
|---|---|
| `/` | Enviar feedback. |
| `/admin` | Revisar feedback persistido. No tiene autenticación por requisito del proyecto. |

## API

### `POST /api/feedback`

Recibe exclusivamente JSON con la propiedad `message`.

```json
{
  "message": "El formulario fue sencillo de usar."
}
```

El servidor elimina espacios en extremos y acepta mensajes entre 1 y 2000 caracteres. El cuerpo completo tiene un límite de 8 KiB.

Respuesta correcta (`201`):

```json
{
  "data": {
    "id": "uuid",
    "message": "El formulario fue sencillo de usar.",
    "createdAt": "2026-10-06T12:00:00.000Z"
  }
}
```

### `GET /api/feedback`

Devuelve las entradas persistidas en orden descendente por `createdAt` y, en caso de empate, por `id`.

```json
{
  "data": []
}
```

Los detalles completos del contrato se encuentran en `contrato-api/api-contract.md`.
