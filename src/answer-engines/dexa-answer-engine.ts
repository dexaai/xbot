import type * as types from '../types.js'
import { AnswerEngine } from '../answer-engine.js'
import { DexaClient } from '../dexa-client.js'

export class DexaAnswerEngine extends AnswerEngine {
  protected readonly _dexaClient: DexaClient

  constructor() {
    super({ type: 'dexa' })

    this._dexaClient = new DexaClient()
  }

  protected override async _generateMessageResponse(
    query: types.AnswerEngineQuery,
    ctx: types.Context
  ): Promise<string> {
    return this._dexaClient.generateResponse({
      messages: query.answerEngineMessages,
      entityMap: query.entityMap
    })
  }
}
