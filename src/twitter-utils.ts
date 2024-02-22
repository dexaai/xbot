import { assert } from 'console'
import twitterText from 'twitter-text'

import { BotError, type BotErrorType } from './bot-error.js'

/**
 * Returns the larger of two Twitter IDs, which is used in several places to
 * keep track of the most recent tweet we've seen or processed.
 */
export function maxTwitterId(
  tweetIdA?: string,
  tweetIdB?: string
): string | undefined {
  if (!tweetIdA && !tweetIdB) {
    return undefined
  }

  if (!tweetIdA) {
    return tweetIdB
  }

  if (!tweetIdB) {
    return tweetIdA
  }

  if (tweetIdA.length < tweetIdB.length) {
    return tweetIdB
  } else if (tweetIdA.length > tweetIdB.length) {
    return tweetIdA
  }

  if (tweetIdA < tweetIdB) {
    return tweetIdB
  }

  return tweetIdA
}

/**
 * Returns the smaller of two Twitter IDs, which is used in several places to
 * keep track of the least recent tweet we've seen or processed.
 */
export function minTwitterId(
  tweetIdA?: string,
  tweetIdB?: string
): string | undefined {
  if (!tweetIdA && !tweetIdB) {
    return undefined
  }

  if (!tweetIdA) {
    return tweetIdB
  }

  if (!tweetIdB) {
    return tweetIdA
  }

  if (tweetIdA.length < tweetIdB.length) {
    return tweetIdA
  } else if (tweetIdA.length > tweetIdB.length) {
    return tweetIdB
  }

  if (tweetIdA < tweetIdB) {
    return tweetIdA
  }

  return tweetIdB
}

/**
 * JS comparator function for comparing two Tweet IDs.
 */
export function tweetIdComparator(a?: string, b?: string): number {
  if (a === b) {
    return 0
  }

  const max = maxTwitterId(a, b)
  if (max === a) {
    return 1
  } else {
    return -1
  }
}

/**
 * JS comparator function for comparing two tweet-like objects.
 */
export function tweetComparator(
  tweetA: { id?: string },
  tweetB: { id?: string }
): number {
  const a = tweetA.id
  const b = tweetB.id
  return tweetIdComparator(a, b)
}

export function getTweetUrl({
  username,
  id
}: {
  username?: string
  id?: string
}): string | undefined {
  if (username && id) {
    return `https://twitter.com/${username}/status/${id}`
  }
}

/**
 * Takes in tweet body plaintext and returns a sanitized version of it that
 * conforms to Twitter's tweet character limits and other restrictions.
 */
export function sanitizeTweetText(
  text: string,
  {
    label = '',
    errorType = 'answer-engine:invalid-response'
  }: { label?: string; errorType?: BotErrorType } = {}
): string {
  text = text.trim()

  if (!twitterText.isInvalidTweet(text)) {
    return text
  }

  if (!text) {
    throw new BotError(`Empty tweet body: ${label}`, {
      type: errorType,
      isFinal: true
    })
  }

  const maxTweetLength = 280
  const twitterUrlCharacterCount = 23

  // Temporarily remove URLs so we can properly truncate the text
  const urlsWithIndices = twitterText.extractUrlsWithIndices(text)
  for (let i = urlsWithIndices.length; i--; ) {
    const { indices } = urlsWithIndices[i]!
    text = text.slice(0, indices[0]) + text.slice(indices[1])
  }

  const maxTweetLengthSansUrls = Math.max(
    3,
    maxTweetLength - 1 - twitterUrlCharacterCount * urlsWithIndices.length
  )

  // Truncate text to fit within the max tweet length
  text = text.slice(0, maxTweetLengthSansUrls - 3).trim() + '... '

  const textWithoutUrls =
    text.slice(0, maxTweetLengthSansUrls - 3).trim() + '... '

  // Re-add urls
  for (let i = urlsWithIndices.length; i--; ) {
    const { url, indices } = urlsWithIndices[i]!
    const suffixOffset = Math.max(indices[1] - url.length, 0)
    const suffix =
      suffixOffset < maxTweetLengthSansUrls ? text.slice(suffixOffset) : ''

    // console.log('1', text, {
    //   url,
    //   indices,
    //   maxTweetLengthSansUrls,
    //   suffixOffset,
    //   suffix
    // })

    text = text.slice(0, indices[0]) + url + suffix
  }

  text = text.trim()

  if (!twitterText.isInvalidTweet(text)) {
    return text
  }

  // TODO: We've already intelligently truncated; now naively truncate, though
  // if our logic above is correct, this should never happen in theory...
  const parsedTweet = twitterText.parseTweet(text)
  assert(!parsedTweet.valid)

  text = textWithoutUrls
  if (!twitterText.isInvalidTweet(text)) {
    return text
  }

  // Something is wrong with this tweet that twitter's validation lib really
  // doesn't like; bail
  throw new BotError(`Invalid tweet text ${label}: ${text}`, {
    type: errorType,
    isFinal: true
  })
}

/**
 * Error handler which takes in an unknown Error object and converts it to a
 * structured BotError object for a set of common Twitter API errors.
 *
 * Re-throws the error and will never return.
 */
export function handleKnownTwitterErrors(
  err: any,
  { label }: { label: string }
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
