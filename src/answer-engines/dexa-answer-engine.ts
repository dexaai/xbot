import type * as types from '../types.js'
import { AnswerEngine } from '../answer-engine.js'
import { DexaClient } from '../services/dexa-client.js'

export class DexaAnswerEngine extends AnswerEngine {
  protected readonly _dexaClient: DexaClient

  constructor() {
    super({ type: 'dexa' })

    this._dexaClient = new DexaClient()
  }

  protected override async _generateResponseForQuery(
    query: types.AnswerEngineQuery,
    ctx: types.AnswerEngineContext
  ): Promise<string> {
    return this._dexaClient.generateResponse({
      messages: query.chatMessages,
      entityMap: query.entityMap
    })
  }
}
