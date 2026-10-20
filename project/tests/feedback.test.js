import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import {
  InvalidRequestError,
  ValidationError,
  validateCreateFeedback
} from '../src/domain/feedback.js';
import { FileFeedbackRepository } from '../src/repositories/file-feedback-repository.js';
import { FeedbackService } from '../src/services/feedback-service.js';

const temporaryDirectories = [];

async function createTestApp(options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'feedback-test-'));
  temporaryDirectories.push(directory);
  const repository = options.repository || new FileFeedbackRepository(path.join(directory, 'feedback.json'));
  const service = new FeedbackService(repository, {
    idFactory: options.idFactory || (() => '11111111-1111-4111-8111-111111111111'),
    now: options.now || (() => new Date('2026-10-06T12:00:00.000Z'))
  });

  return createApp(service);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe('validateCreateFeedback', () => {
  it('normalizes a valid message', () => {
    expect(validateCreateFeedback({ message: '  Comentario válido  ' })).toEqual({
      message: 'Comentario válido'
    });
  });

  it('rejects invalid object shapes and invalid messages', () => {
    expect(() => validateCreateFeedback(null)).toThrow(InvalidRequestError);
    expect(() => validateCreateFeedback({ message: 'ok', id: 'forced' })).toThrow(InvalidRequestError);
    expect(() => validateCreateFeedback({ message: '   ' })).toThrow(ValidationError);
    expect(() => validateCreateFeedback({ message: 'x'.repeat(2001) })).toThrow(ValidationError);
    expect(() => validateCreateFeedback({ message: 12 })).toThrow(ValidationError);
  });
});

describe('FeedbackService', () => {
  it('generates server-owned fields before persisting', async () => {
    const saved = [];
    const service = new FeedbackService(
      { add: async (feedback) => saved.push(feedback), list: async () => saved },
      {
        idFactory: () => 'server-id',
        now: () => new Date('2026-10-06T12:00:00.000Z')
      }
    );

    await expect(service.create({ message: '  Hola  ' })).resolves.toEqual({
      id: 'server-id',
      message: 'Hola',
      createdAt: '2026-10-06T12:00:00.000Z'
    });
    expect(saved).toHaveLength(1);
  });
});

describe('feedback HTTP API', () => {
  it('creates normalized feedback and lists it from local persistence', async () => {
    const app = await createTestApp();

    const created = await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send({ message: '  Comentario persistido  ' })
      .expect(201);

    expect(created.headers.location).toBe('/api/feedback');
    expect(created.body.data.message).toBe('Comentario persistido');

    const listed = await request(app).get('/api/feedback').expect(200);
    expect(listed.body.data).toEqual([created.body.data]);
  });

  it('rejects invalid requests without creating entries', async () => {
    const app = await createTestApp();

    const response = await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send({ message: ' ', createdAt: 'forced' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_REQUEST');
    await expect(request(app).get('/api/feedback')).resolves.toMatchObject({
      body: { data: [] }
    });
  });

  it('returns validation, media type, malformed JSON and body size errors from the contract', async () => {
    const app = await createTestApp();

    await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send({})
      .expect(400)
      .expect(({ body }) => expect(body.error.fields.message).toBeTruthy());

    await request(app)
      .post('/api/feedback')
      .send('plain text')
      .expect(415);

    await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send('{"message":')
      .expect(400);

    await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ message: 'x'.repeat(9000) }))
      .expect(413);
  });

  it('uses deterministic descending ordering', async () => {
    let currentTime = 0;
    const app = await createTestApp({
      idFactory: (() => {
        const ids = ['a', 'z'];
        return () => ids.shift();
      })(),
      now: () => new Date(`2026-10-06T12:00:0${currentTime++}.000Z`)
    });

    await request(app).post('/api/feedback').set('Content-Type', 'application/json').send({ message: 'Primero' });
    await request(app).post('/api/feedback').set('Content-Type', 'application/json').send({ message: 'Segundo' });

    const response = await request(app).get('/api/feedback').expect(200);
    expect(response.body.data.map((item) => item.message)).toEqual(['Segundo', 'Primero']);
  });

  it('does not expose storage failures', async () => {
    const app = await createTestApp({
      repository: {
        add: async () => {
          throw new Error('/secret/location failed');
        },
        list: async () => {
          throw new Error('/secret/location failed');
        }
      }
    });

    const writeFailure = await request(app)
      .post('/api/feedback')
      .set('Content-Type', 'application/json')
      .send({ message: 'Mensaje válido' })
      .expect(500);

    expect(writeFailure.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'No se pudo guardar el feedback. Inténtalo de nuevo.'
    });

    const readFailure = await request(app).get('/api/feedback').expect(500);
    expect(readFailure.body.error.message).not.toContain('/secret');
  });
});
