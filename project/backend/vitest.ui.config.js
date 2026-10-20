import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/feedback-client.test.js']
  }
});
