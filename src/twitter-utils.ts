import { BotError } from './bot-error.js'

export * from 'twitter-utils'

/**
 * Error handler which takes in an unknown Error object and converts it to a
 * structured BotError object for a set of common Twitter API errors.
 *
 * Re-throws the error and will never return.
 */
export function handleKnownTwitterErrors(
  err: any,
  { label = '' }: { label?: string } = {}
) {
  if (err.status === 403) {
    // user may have deleted the tweet we're trying to respond to
    throw new BotError(err.error?.detail || `error ${label}: 403 forbidden`, {
      type: 'twitter:forbidden',
      isFinal: true,
      cause: err
    })
  } else if (err.status === 400) {
    if (
      /value passed for the token was invalid/i.test(
        err.error?.error_description
      )
    ) {
      throw new BotError(`error ${label}: invalid auth token`, {
        type: 'twitter:auth',
        cause: err
      })
    }
  } else if (err.status === 429) {
    throw new BotError(`error ${label}: too many requests`, {
      type: 'twitter:rate-limit',
      cause: err
    })
  } else if (err.status === 404) {
    throw new BotError(err.toString(), {
      type: 'twitter:forbidden',
      isFinal: true,
      cause: err
    })
  }

  if (err.status >= 400 && err.status < 500) {
    throw new BotError(
      `error ${label}: ${err.status} ${
        err.error?.description || err.toString()
      }`,
      {
        type: 'twitter:unknown',
        isFinal: true,
        cause: err
      }
    )
  } else if (err.status >= 500) {
    throw new BotError(
      `error ${label}: ${err.status} ${
        err.error?.description || err.toString()
      }`,
      {
        type: 'twitter:unknown',
        isFinal: false,
        cause: err
      }
    )
  }

  const reason = err.toString().toLowerCase()

  if (reason.includes('fetcherror') || reason.includes('enotfound')) {
    throw new BotError(err.toString(), {
      type: 'network',
      cause: err
    })
  }

  // Otherwise, propagate the original error
  throw err
}
