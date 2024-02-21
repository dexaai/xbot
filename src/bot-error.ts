export type BotErrorType =
  | 'twitter:forbidden'
  | 'twitter:auth'
  | 'twitter:rate-limit'
  | 'twitter:unknown'
  | 'answer-engine:invalid-response'
  | 'network'
  | 'moderation'

export class BotError extends Error {
  type: BotErrorType
  isFinal: boolean
  status?: number

  constructor(
    message: string,
    {
      type,
      isFinal = false,
      status,
      ...opts
    }: ErrorOptions & {
      type: BotErrorType
      isFinal?: boolean
      status?: number
    }
  ) {
    super(message, opts)

    this.type = type
    this.isFinal = isFinal
    this.status = status ?? (opts.cause as any)?.status
  }
}
