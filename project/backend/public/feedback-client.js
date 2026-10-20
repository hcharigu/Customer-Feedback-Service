export const MAX_MESSAGE_LENGTH = 2000;

export class FeedbackApiError extends Error {
  constructor(message, { fieldMessage = '', status = 0 } = {}) {
    super(message);
    this.name = 'FeedbackApiError';
    this.fieldMessage = fieldMessage;
    this.status = status;
  }
}

export function localMessageError(value) {
  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > MAX_MESSAGE_LENGTH) {
    return 'Escribe un comentario de entre 1 y 2000 caracteres.';
  }

  return '';
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function createFeedback(message, fetchImplementation = fetch) {
  let response;

  try {
    response = await fetchImplementation('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
  } catch {
    throw new FeedbackApiError(
      'No se pudo enviar el feedback. Inténtalo de nuevo.'
    );
  }

  const body = await parseJson(response);

  if (response.status === 201 && body?.data) {
    return body.data;
  }

  throw new FeedbackApiError(
    body?.error?.message || 'No se pudo enviar el feedback. Inténtalo de nuevo.',
    {
      fieldMessage: body?.error?.fields?.message || '',
      status: response.status
    }
  );
}

export async function listFeedback(fetchImplementation = fetch) {
  let response;

  try {
    response = await fetchImplementation('/api/feedback');
  } catch {
    throw new FeedbackApiError(
      'No se pudo cargar el feedback. Inténtalo de nuevo.'
    );
  }

  const body = await parseJson(response);

  if (response.ok && Array.isArray(body?.data)) {
    return body.data;
  }

  throw new FeedbackApiError(
    body?.error?.message || 'No se pudo cargar el feedback. Inténtalo de nuevo.',
    { status: response.status }
  );
}
