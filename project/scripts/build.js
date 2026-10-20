import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'public/index.html',
  'public/app.js',
  'public/styles.css',
  'src/server.js'
];

for (const file of requiredFiles) {
  await access(path.resolve(file), constants.R_OK);
}

await mkdir(path.resolve('dist'), { recursive: true });
console.log('Build assets are available in public/.');
