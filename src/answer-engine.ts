import * as types from './types.js'
import { BotError } from './bot-error.js'

export async function generateMessageResponse(
  message: types.Message,
  ctx: types.Context
): Promise<types.Message> {
  // TODO
  throw new Error('not implemented')

  // TODO: validate the response length
  return message
}
