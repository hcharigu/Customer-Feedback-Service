import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.js',
      'tests/integration/**/*.test.js',
      'tests/feedback-client.test.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.js',
        'public/feedback-client.js'
      ],
      exclude: [
        'src/server.js'
      ]
    }
  }
});
