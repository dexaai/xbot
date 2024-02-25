import { ChatModel } from '@dexaai/dexter'
import { OpenAIClient } from 'openai-fetch'

import { OpenAIAnswerEngine } from './openai-answer-engine.js'

export class PerplexityAnswerEngine extends OpenAIAnswerEngine {
  constructor({ chatModel }: { chatModel?: ChatModel } = {}) {
    super({ type: 'perplexity' })

    if (!chatModel) {
      if (!process.env.PERPLEXITY_API_KEY) {
        throw new Error(
          'PerplexityAnswerEngine missing required "PERPLEXITY_API_KEY"'
        )
      }

      chatModel = new ChatModel({
        client: new OpenAIClient({
          apiKey: process.env.PERPLEXITY_API_KEY,
          baseUrl: 'https://api.perplexity.ai'
        }),
        params: {
          model: 'pplx-70b-chat'
        }
      })
    }

    this._chatModel = chatModel
  }
}
