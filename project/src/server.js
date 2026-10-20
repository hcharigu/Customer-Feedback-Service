import path from 'node:path';
import { createApp } from './app.js';
import { FileFeedbackRepository } from './repositories/file-feedback-repository.js';
import { FeedbackService } from './services/feedback-service.js';

const port = Number(process.env.PORT || 3000);
const dataFile = process.env.FEEDBACK_DATA_FILE ||
  path.resolve(process.cwd(), 'data', 'feedback.json');

const repository = new FileFeedbackRepository(dataFile);
const feedbackService = new FeedbackService(repository);
const app = createApp(feedbackService);

app.listen(port, () => {
  console.log(`Customer Feedback Service listening on http://localhost:${port}`);
});
