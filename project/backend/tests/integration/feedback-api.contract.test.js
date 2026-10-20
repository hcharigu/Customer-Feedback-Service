import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../src/app.js';
import { FileFeedbackRepository } from '../../src/repositories/file-feedback-repository.js';
import { FeedbackService } from '../../src/services/feedback-service.js';

const temporaryDirectories = [];

async function createTestApp({ repository, idFactory, now } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'feedback-api-'));
  temporaryDirectories.push(directory);

  const feedbackRepository = repository || new FileFeedbackRepository(
    path.join(directory, 'feedback.json')
  );

  return createApp(new FeedbackService(feedbackRepository, {
    idFactory: idFactory || (() => '11111111-1111-4111-8111-111111111111'),
    now: now || (() => new Date('2026-10-06T12:00:00.000Z'))
  }));
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe('Customer Feedback API contract', () => {
  it('CT-001/CT-002 creates a normalized feedback resource with server-owned values', async () => {
    const app = await createTestApp();

    const response = await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send({ message: '  Comentario válido  ' })
      .expect(201);

    expect(response.headers.location).toBe('/api/feedback');
    expect(response.body).toEqual({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        message: 'Comentario válido',
        createdAt: '2026-10-06T12:00:00.000Z'
      }
    });
  });

  it.each([
    ['CT-003 missing message', {}, 'VALIDATION_ERROR', 'message'],
    ['CT-004 whitespace message', { message: ' \n ' }, 'VALIDATION_ERROR', 'message'],
    ['CT-005 oversized message', { message: 'x'.repeat(2001) }, 'VALIDATION_ERROR', 'message'],
    ['non-string message', { message: 42 }, 'VALIDATION_ERROR', 'message'],
    ['CT-006 server-owned property', { message: 'válido', id: 'forced' }, 'INVALID_REQUEST'],
    ['unexpected property', { message: 'válido', extra: true }, 'INVALID_REQUEST']
  ])('rejects %s and does not persist it', async (
    _scenario,
    payload,
    expectedCode,
    expectedField
  ) => {
    const app = await createTestApp();

    const rejected = await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(400);

    expect(rejected.body.error.code).toBe(expectedCode);
    expect(rejected.body.error.message).not.toMatch(/secret|path|stack/i);

    if (expectedField) {
      expect(rejected.body.error.fields).toHaveProperty(expectedField);
    } else {
      expect(rejected.body.error.fields).toBeUndefined();
    }

    await request(app)
      .get('/api/feedback')
      .expect(200)
      .expect({ data: [] });
  });

  it('CT-007 returns the stable malformed JSON response', async () => {
    const app = await createTestApp();

    const response = await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send('{"message":')
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'La solicitud no tiene un formato válido.'
      }
    });
  });

  it('CT-008 rejects a body larger than 8 KiB before it can be persisted', async () => {
    const app = await createTestApp();

    const response = await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ message: 'x'.repeat(9_000) }))
      .expect(413);

    expect(response.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'La solicitud supera el tamaño máximo permitido.'
      }
    });

    await request(app).get('/api/feedback').expect({ data: [] });
  });

  it('CT-009 rejects a non-JSON content type', async () => {
    const app = await createTestApp();

    const response = await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'text/plain')
      .send('comentario')
      .expect(415);

    expect(response.body).toEqual({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'La solicitud debe enviarse como JSON.'
      }
    });
  });

  it('CT-010 returns an empty array from a new isolated store', async () => {
    const app = await createTestApp();

    await request(app)
      .get('/api/feedback')
      .expect(200)
      .expect({ data: [] });
  });

  it('CT-011 lists feedback newest-first and resolves timestamp ties by descending id', async () => {
    const ids = ['a', 'z', 'm'];
    const dates = [
      '2026-10-06T10:00:00.000Z',
      '2026-10-06T11:00:00.000Z',
      '2026-10-06T11:00:00.000Z'
    ];
    const app = await createTestApp({
      idFactory: () => ids.shift(),
      now: () => new Date(dates.shift())
    });

    for (const message of ['Antiguo', 'Empate z', 'Empate m']) {
      await request(app)
        .post('/api/feedback')
        .set('Content-Type', 'application/json')
        .send({ message })
        .expect(201);
    }

    const listed = await request(app).get('/api/feedback').expect(200);

    expect(listed.body.data.map((entry) => entry.message)).toEqual([
      'Empate z',
      'Empate m',
      'Antiguo'
    ]);
  });

  it('CT-012 returns generic responses when local persistence fails', async () => {
    const internalDetail = '/private/storage/feedback.json';
    const app = await createTestApp({
      repository: {
        add: async () => {
          throw new Error(internalDetail);
        },
        list: async () => {
          throw new Error(internalDetail);
        }
      }
    });

    const writeError = await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send({ message: 'Mensaje válido' })
      .expect(500);

    expect(writeError.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'No se pudo guardar el feedback. Inténtalo de nuevo.'
      }
    });
    expect(JSON.stringify(writeError.body)).not.toContain(internalDetail);

    const readError = await request(app).get('/api/feedback').expect(500);

    expect(readError.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'No se pudo cargar el feedback. Inténtalo de nuevo.'
      }
    });
    expect(JSON.stringify(readError.body)).not.toContain(internalDetail);
  });
});
