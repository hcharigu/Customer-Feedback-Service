import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compareFeedbackDescending } from '../domain/feedback.js';

export class FileFeedbackRepository {
  #writeQueue = Promise.resolve();

  constructor(filePath) {
    this.filePath = filePath;
  }

  async list() {
    const feedback = await this.#readAll();
    return [...feedback].sort(compareFeedbackDescending);
  }

  async add(feedback) {
    const operation = this.#writeQueue.then(async () => {
      const entries = await this.#readAll();
      entries.push(feedback);
      await this.#writeAll(entries);
    });

    this.#writeQueue = operation.catch(() => undefined);
    await operation;
    return feedback;
  }

  async #readAll() {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        throw new Error('Invalid feedback storage format');
      }

      return parsed;
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  async #writeAll(entries) {
    const directory = path.dirname(this.filePath);
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;

    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(entries, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    });
    await rename(temporaryPath, this.filePath);
  }
}
