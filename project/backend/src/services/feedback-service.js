import { randomUUID } from 'node:crypto';
import { validateCreateFeedback } from '../domain/feedback.js';

export class FeedbackService {
  constructor(repository, { idFactory = randomUUID, now = () => new Date() } = {}) {
    this.repository = repository;
    this.idFactory = idFactory;
    this.now = now;
  }

  async create(payload) {
    const { message } = validateCreateFeedback(payload);
    const feedback = {
      id: this.idFactory(),
      message,
      createdAt: this.now().toISOString()
    };

    await this.repository.add(feedback);
    return feedback;
  }

  async list() {
    return this.repository.list();
  }
}
