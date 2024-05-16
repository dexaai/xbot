import { type AnswerEngine } from './answer-engine.js'
import { DexaAnswerEngine } from './answer-engines/dexa-answer-engine.js'
import { OpenAIAnswerEngine } from './answer-engines/openai-answer-engine.js'
import { PerplexityAnswerEngine } from './answer-engines/perplexity-answer-engine.js'
import type * as types from './types.js'

export function createAnswerEngine(
  answerEngineType: types.AnswerEngineType
): AnswerEngine {
  switch (answerEngineType) {
    case 'openai':
      return new OpenAIAnswerEngine()

    case 'dexa':
      return new DexaAnswerEngine()

    case 'perplexity':
      return new PerplexityAnswerEngine()

    default:
      throw new Error(`Unknown answer engine: ${answerEngineType}`)
  }
}
