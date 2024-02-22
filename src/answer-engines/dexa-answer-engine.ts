import { type Prompt } from '@dexaai/dexter'

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
    {
      message,
      messageThread
    }: {
      message: types.Message
      messageThread: Prompt.Msg[]
    },
    ctx: types.Context
  ): Promise<string> {
    return this._dexaClient.generateResponse({ messages: messageThread })
  }
}
