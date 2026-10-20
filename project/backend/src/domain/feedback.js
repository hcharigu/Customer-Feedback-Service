export const MAX_MESSAGE_LENGTH = 2000;

export class ValidationError extends Error {
  constructor(message = 'Revisa los datos enviados.') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InvalidRequestError extends Error {
  constructor(message = 'La solicitud no tiene un formato válido.') {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

export function validateCreateFeedback(payload) {
  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    throw new InvalidRequestError();
  }

  const keys = Object.keys(payload);
  if (keys.length === 0) {
    throw new ValidationError();
  }

  if (keys.length !== 1 || keys[0] !== 'message') {
    throw new InvalidRequestError();
  }

  if (typeof payload.message !== 'string') {
    throw new ValidationError();
  }

  const message = payload.message.trim();
  if (message.length === 0 || message.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError();
  }

  return { message };
}

export function compareFeedbackDescending(left, right) {
  const dateComparison = right.createdAt.localeCompare(left.createdAt);
  return dateComparison !== 0 ? dateComparison : right.id.localeCompare(left.id);
}
