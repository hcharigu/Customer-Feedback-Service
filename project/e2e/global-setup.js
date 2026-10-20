import { rm } from 'node:fs/promises';
import path from 'node:path';

export default async function globalSetup() {
  await rm(path.resolve('data', 'e2e-feedback.json'), { force: true });
}
