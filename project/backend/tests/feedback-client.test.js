import { describe, expect, it, vi } from 'vitest';
import {
  FeedbackApiError,
  createFeedback,
  listFeedback,
  localMessageError
} from '../public/feedback-client.js';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

describe('localMessageError', () => {
  it('accepts normalized messages at both inclusive boundaries', () => {
    expect(localMessageError('  x  ')).toBe('');
    expect(localMessageError('x'.repeat(2000))).toBe('');
  });

  it.each([
    ['', 'empty'],
    ['  \t ', 'whitespace only'],
    ['x'.repeat(2001), 'over 2000 characters']
  ])('rejects %s input', (message) => {
    expect(localMessageError(message)).toBe(
      'Escribe un comentario de entre 1 y 2000 caracteres.'
    );
  });
});

describe('createFeedback', () => {
  it('sends only the contract payload and returns a created resource', async () => {
    const feedback = {
      id: '11111111-1111-4111-8111-111111111111',
      message: 'Comentario válido',
      createdAt: '2026-10-06T12:00:00.000Z'
    };
    const fetchImplementation = vi.fn().mockResolvedValue(
      jsonResponse(201, { data: feedback })
    );

    await expect(
      createFeedback('Comentario válido', fetchImplementation)
    ).resolves.toEqual(feedback);

    expect(fetchImplementation).toHaveBeenCalledWith('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Comentario válido' })
    });
  });

  it('preserves API field errors so the form can associate them with the textarea', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Revisa los datos enviados.',
          fields: {
            message: 'Escribe un comentario de entre 1 y 2000 caracteres.'
          }
        }
      })
    );

    await expect(createFeedback(' ', fetchImplementation)).rejects.toMatchObject({
      name: 'FeedbackApiError',
      message: 'Revisa los datos enviados.',
      fieldMessage: 'Escribe un comentario de entre 1 y 2000 caracteres.',
      status: 400
    });
  });

  it('converts malformed error responses and network details into safe submit errors', async () => {
    const malformedResponse = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('invalid JSON');
      }
    });
    const networkFailure = vi.fn().mockRejectedValue(
      new Error('socket at internal-host')
    );

    await expect(
      createFeedback('Comentario válido', malformedResponse)
    ).rejects.toMatchObject({
      name: 'FeedbackApiError',
      message: 'No se pudo enviar el feedback. Inténtalo de nuevo.',
      status: 500
    });

    await expect(
      createFeedback('Comentario válido', networkFailure)
    ).rejects.toEqual(expect.objectContaining({
      name: 'FeedbackApiError',
      message: 'No se pudo enviar el feedback. Inténtalo de nuevo.',
      status: 0
    }));
  });
});

describe('listFeedback', () => {
  it('returns an empty collection as a valid review state', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [] })
    );

    await expect(listFeedback(fetchImplementation)).resolves.toEqual([]);
  });

  it('maps failed HTTP and network responses to safe review errors', async () => {
    const failedResponse = vi.fn().mockResolvedValue(
      jsonResponse(500, {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'No se pudo cargar el feedback. Inténtalo de nuevo.'
        }
      })
    );
    const networkFailure = vi.fn().mockRejectedValue(
      new Error('network implementation detail')
    );

    await expect(listFeedback(failedResponse)).rejects.toBeInstanceOf(FeedbackApiError);
    await expect(listFeedback(failedResponse)).rejects.toMatchObject({
      message: 'No se pudo cargar el feedback. Inténtalo de nuevo.',
      status: 500
    });
    await expect(listFeedback(networkFailure)).rejects.toMatchObject({
      message: 'No se pudo cargar el feedback. Inténtalo de nuevo.',
      status: 0
    });
  });
});
