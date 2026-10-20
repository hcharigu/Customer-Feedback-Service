import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InvalidRequestError,
  ValidationError
} from './domain/feedback.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, '../public');

function errorBody(code, message, fields) {
  return {
    error: {
      code,
      message,
      ...(fields ? { fields } : {})
    }
  };
}

function acceptsJson(request) {
  return request.is('application/json') === 'application/json';
}

export function createApp(feedbackService) {
  const app = express();

  app.disable('x-powered-by');

  app.use(express.json({
    limit: '8kb',
    type: 'application/json'
  }));

  app.post('/api/feedback', async (request, response) => {
    if (!acceptsJson(request)) {
      return response.status(415).json(
        errorBody('UNSUPPORTED_MEDIA_TYPE', 'La solicitud debe enviarse como JSON.')
      );
    }

    try {
      const feedback = await feedbackService.create(request.body);
      return response
        .status(201)
        .location('/api/feedback')
        .json({ data: feedback });
    } catch (error) {
      if (error instanceof ValidationError) {
        return response.status(400).json(
          errorBody('VALIDATION_ERROR', 'Revisa los datos enviados.', {
            message: 'Escribe un comentario de entre 1 y 2000 caracteres.'
          })
        );
      }

      if (error instanceof InvalidRequestError) {
        return response.status(400).json(
          errorBody('INVALID_REQUEST', 'La solicitud no tiene un formato válido.')
        );
      }

      return response.status(500).json(
        errorBody('INTERNAL_ERROR', 'No se pudo guardar el feedback. Inténtalo de nuevo.')
      );
    }
  });

  app.get('/api/feedback', async (_request, response) => {
    try {
      const feedback = await feedbackService.list();
      return response.status(200).json({ data: feedback });
    } catch {
      return response.status(500).json(
        errorBody('INTERNAL_ERROR', 'No se pudo cargar el feedback. Inténtalo de nuevo.')
      );
    }
  });

  app.use('/api', (_request, response) => {
    response.status(404).json(
      errorBody('NOT_FOUND', 'No se encontró el recurso solicitado.')
    );
  });

  app.use(express.static(publicDirectory));

  app.get(['/', '/admin'], (_request, response) => {
    response.sendFile(path.join(publicDirectory, 'index.html'));
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return response.status(400).json(
        errorBody('INVALID_REQUEST', 'La solicitud no tiene un formato válido.')
      );
    }

    if (error?.type === 'entity.too.large') {
      return response.status(413).json(
        errorBody('PAYLOAD_TOO_LARGE', 'La solicitud supera el tamaño máximo permitido.')
      );
    }

    return response.status(500).json(
      errorBody('INTERNAL_ERROR', 'No se pudo completar la operación. Inténtalo de nuevo.')
    );
  });

  return app;
}
