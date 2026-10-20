import { describe, expect, it, vi } from 'vitest';
import {
  InvalidRequestError,
  ValidationError
} from '../../src/domain/feedback.js';
import { FeedbackService } from '../../src/services/feedback-service.js';

describe('FeedbackService', () => {
  it('generates server-owned fields and persists only the normalized entity', async () => {
    const repository = {
      add: vi.fn().mockResolvedValue(undefined),
      list: vi.fn()
    };
    const service = new FeedbackService(repository, {
      idFactory: () => 'server-generated-id',
      now: () => new Date('2026-10-06T12:00:00.000Z')
    });

    await expect(service.create({ message: '  Comentario válido  ' })).resolves.toEqual({
      id: 'server-generated-id',
      message: 'Comentario válido',
      createdAt: '2026-10-06T12:00:00.000Z'
    });

    expect(repository.add).toHaveBeenCalledTimes(1);
    expect(repository.add).toHaveBeenCalledWith({
      id: 'server-generated-id',
      message: 'Comentario válido',
      createdAt: '2026-10-06T12:00:00.000Z'
    });
  });

  it.each([
    [{ message: '   ' }, ValidationError],
    [{ message: 'válido', id: 'forced' }, InvalidRequestError]
  ])('does not call the repository when validation fails', async (payload, errorType) => {
    const repository = {
      add: vi.fn(),
      list: vi.fn()
    };
    const service = new FeedbackService(repository);

    await expect(service.create(payload)).rejects.toBeInstanceOf(errorType);
    expect(repository.add).not.toHaveBeenCalled();
  });

  it('returns the repository listing without changing its persisted values', async () => {
    const entries = [{
      id: 'entry-1',
      message: 'Persistido',
      createdAt: '2026-10-06T12:00:00.000Z'
    }];
    const repository = {
      add: vi.fn(),
      list: vi.fn().mockResolvedValue(entries)
    };
    const service = new FeedbackService(repository);

    await expect(service.list()).resolves.toEqual(entries);
    expect(repository.list).toHaveBeenCalledTimes(1);
  });
});
