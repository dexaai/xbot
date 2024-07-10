import { AnswerEngine } from '../answer-engine.js';
import { RotobotClient } from '../services/rotobot-client.js';
import type * as types from '../types.js';

export class RotobotAnswerEngine extends AnswerEngine {
  protected readonly _rotobotClient: RotobotClient;

  constructor() {
    super({ type: 'rotobot' as types.AnswerEngineType });
    this._rotobotClient = new RotobotClient();
  }

  protected override async _generateResponseForQuery(
    query: types.AnswerEngineQuery,
    _: types.AnswerEngineContext
  ): Promise<string> {
    const requestBody = {
      initial_query: query.chatMessages.join(' '),  // Assuming chatMessages is an array of strings
      user_email: '',
      title: '',
    };

    return this._rotobotClient.fetchRotobotAnswer(requestBody);
  }
}
