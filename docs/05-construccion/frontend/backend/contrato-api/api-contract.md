# Contrato API — Customer Feedback Service

Versión: `1.0.0`

La API se ejecuta localmente bajo el mismo origen que la interfaz. No implementa autenticación, autorización, sesiones, JWT, API keys ni integraciones externas.

## Modelo

```ts
interface CreateFeedbackRequest {
  message: string;
}

interface Feedback {
  id: string;
  message: string;
  createdAt: string;
}
```

- `id` es generado por el servidor.
- `createdAt` es una fecha ISO 8601 UTC generada por el servidor.
- `message` es texto plano. El servidor aplica `trim()` antes de validarlo y persistirlo.
- Tras normalizarse, `message` debe tener entre 1 y 2000 caracteres.
- La creación acepta exclusivamente la propiedad `message`.
- El cuerpo de creación no puede superar 8 KiB.
- El listado se ordena por `createdAt` descendente y, ante empate, por `id` descendente.

## `POST /api/feedback`

Crea una entrada de feedback persistida localmente.

### Solicitud

Cabecera obligatoria:

```http
Content-Type: application/json
```

Cuerpo:

```json
{
  "message": "El formulario fue sencillo de usar."
}
```

### Respuesta correcta

Estado `201 Created` con cabecera `Location: /api/feedback`:

```json
{
  "data": {
    "id": "f54f2e5a-1b8e-4b9b-86a7-2a2205046f53",
    "message": "El formulario fue sencillo de usar.",
    "createdAt": "2026-10-06T12:00:00.000Z"
  }
}
```

### Errores

#### Datos de campo no válidos

Estado `400 Bad Request`:

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

Se utiliza cuando `message` falta, no es una cadena, queda vacío tras eliminar espacios o supera 2000 caracteres.

#### Solicitud no válida

Estado `400 Bad Request`:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "La solicitud no tiene un formato válido."
  }
}
```

Se utiliza para JSON malformado, un cuerpo JSON que no sea un objeto y propiedades distintas de `message`.

#### Tipo de contenido no admitido

Estado `415 Unsupported Media Type`:

```json
{
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "La solicitud debe enviarse como JSON."
  }
}
```

#### Cuerpo demasiado grande

Estado `413 Payload Too Large`:

```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "La solicitud supera el tamaño máximo permitido."
  }
}
```

#### Error interno

Estado `500 Internal Server Error`:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "No se pudo guardar el feedback. Inténtalo de nuevo."
  }
}
```

Las respuestas no incluyen rutas de archivos, trazas, secretos ni detalles de almacenamiento.

## `GET /api/feedback`

Devuelve todas las entradas persistidas localmente. No acepta filtros, paginación ni parámetros de consulta.

### Respuesta correcta

Estado `200 OK`:

```json
{
  "data": [
    {
      "id": "f54f2e5a-1b8e-4b9b-86a7-2a2205046f53",
      "message": "El formulario fue sencillo de usar.",
      "createdAt": "2026-10-06T12:00:00.000Z"
    }
  ]
}
```

Cuando no hay entradas:

```json
{
  "data": []
}
```

### Error interno

Estado `500 Internal Server Error`:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "No se pudo cargar el feedback. Inténtalo de nuevo."
  }
}
```

## Límites de seguridad

- Las propiedades adicionales, incluidos `id` y `createdAt`, se rechazan para evitar asignación masiva.
- Las entradas se persisten sólo después de validación de servidor.
- La interfaz representa `message` como texto, nunca mediante inserción HTML.
- El archivo de persistencia local no se publica como recurso estático.
- La ruta `/admin` es accesible sin autenticación por una restricción explícita del alcance.
