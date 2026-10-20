import { describe, expect, it } from 'vitest';
import {
  InvalidRequestError,
  MAX_MESSAGE_LENGTH,
  ValidationError,
  compareFeedbackDescending,
  validateCreateFeedback
} from '../../src/domain/feedback.js';

describe('validateCreateFeedback', () => {
  it('accepts the lower length boundary and trims outer whitespace', () => {
    expect(validateCreateFeedback({ message: '  x  ' })).toEqual({
      message: 'x'
    });
  });

  it('accepts the maximum message length after normalization', () => {
    const message = 'x'.repeat(MAX_MESSAGE_LENGTH);

    expect(validateCreateFeedback({ message: `  ${message}  ` })).toEqual({
      message
    });
  });

  it.each([
    ['null', null],
    ['array', []],
    ['number', 10],
    ['string', 'comentario']
  ])('rejects a %s payload as an invalid request', (_scenario, payload) => {
    expect(() => validateCreateFeedback(payload)).toThrow(InvalidRequestError);
  });

  it.each([
    ['missing message', {}],
    ['additional id', { message: 'válido', id: 'client-id' }],
    ['additional createdAt', { message: 'válido', createdAt: '2026-10-06T00:00:00.000Z' }],
    ['additional arbitrary property', { message: 'válido', unexpected: true }]
  ])('rejects %s to prevent mass assignment', (_scenario, payload) => {
    expect(() => validateCreateFeedback(payload)).toThrow(InvalidRequestError);
  });

  it.each([
    ['missing value', undefined],
    ['number', 12],
    ['boolean', false],
    ['empty string', ''],
    ['only whitespace', ' \n\t '],
    ['over the maximum', 'x'.repeat(MAX_MESSAGE_LENGTH + 1)]
  ])('rejects a message with %s', (_scenario, message) => {
    expect(() => validateCreateFeedback({ message })).toThrow(ValidationError);
  });
});

describe('compareFeedbackDescending', () => {
  it('orders newest entries before older entries', () => {
    const older = {
      id: 'z',
      message: 'older',
      createdAt: '2026-10-06T10:00:00.000Z'
    };
    const newer = {
      id: 'a',
      message: 'newer',
      createdAt: '2026-10-06T11:00:00.000Z'
    };

    expect([older, newer].sort(compareFeedbackDescending)).toEqual([newer, older]);
  });

  it('uses descending id order when timestamps are equal', () => {
    const sameTime = '2026-10-06T10:00:00.000Z';
    const firstByContract = { id: 'z', message: 'z', createdAt: sameTime };
    const secondByContract = { id: 'a', message: 'a', createdAt: sameTime };

    expect(
      [secondByContract, firstByContract].sort(compareFeedbackDescending)
    ).toEqual([firstByContract, secondByContract]);
  });
});
