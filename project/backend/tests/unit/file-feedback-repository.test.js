import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileFeedbackRepository } from '../../src/repositories/file-feedback-repository.js';

const directories = [];

async function createRepository() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'feedback-repository-'));
  directories.push(directory);

  return {
    directory,
    filePath: path.join(directory, 'store', 'feedback.json'),
    repository: new FileFeedbackRepository(
      path.join(directory, 'store', 'feedback.json')
    )
  };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe('FileFeedbackRepository', () => {
  it('returns an empty collection before the storage file exists', async () => {
    const { repository } = await createRepository();

    await expect(repository.list()).resolves.toEqual([]);
  });

  it('persists entries and returns them in contract order', async () => {
    const { repository, filePath } = await createRepository();

    await repository.add({
      id: 'a',
      message: 'Más antiguo',
      createdAt: '2026-10-06T10:00:00.000Z'
    });
    await repository.add({
      id: 'z',
      message: 'Empate de fecha',
      createdAt: '2026-10-06T11:00:00.000Z'
    });
    await repository.add({
      id: 'a',
      message: 'Misma fecha, segundo id',
      createdAt: '2026-10-06T11:00:00.000Z'
    });

    await expect(repository.list()).resolves.toMatchObject([
      { id: 'z', message: 'Empate de fecha' },
      { id: 'a', message: 'Misma fecha, segundo id' },
      { id: 'a', message: 'Más antiguo' }
    ]);

    await expect(readFile(filePath, 'utf8')).resolves.toContain('Más antiguo');
  });

  it('propagates an invalid local storage format instead of treating it as valid data', async () => {
    const { repository, filePath } = await createRepository();

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, '{"unexpected":"object"}', 'utf8');

    await expect(repository.list()).rejects.toThrow('Invalid feedback storage format');
  });

  it('serializes concurrent additions without losing either entry', async () => {
    const { repository } = await createRepository();

    await Promise.all([
      repository.add({
        id: 'a',
        message: 'Primero',
        createdAt: '2026-10-06T10:00:00.000Z'
      }),
      repository.add({
        id: 'b',
        message: 'Segundo',
        createdAt: '2026-10-06T11:00:00.000Z'
      })
    ]);

    await expect(repository.list()).resolves.toHaveLength(2);
  });
});
