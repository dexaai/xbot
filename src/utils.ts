import { customAlphabet, urlAlphabet } from 'nanoid'
import invariant from 'tiny-invariant'
import urlRegex from 'url-regex'

import type * as types from './types.js'

export const rUrl = urlRegex()

export { invariant as assert }

/**
 * From `obj`, create a new object that does not include `keys`.
 *
 * @example
 * ```
 * omit({ a: 1, b: 2, c: 3 }, 'a', 'c') // { b: 2 }
 * ```
 */
export const omit = <T extends Record<any, unknown>, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(obj).filter(([k]) => !keys.includes(k as any))
  ) as any

/**
 * From `obj`, create a new object that only includes `keys`.
 *
 * @example
 * ```
 * pick({ a: 1, b: 2, c: 3 }, 'a', 'c') // { a: 1, c: 3 }
 * ```
 */
export const pick = <T extends Record<any, unknown>, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Pick<T, K> =>
  Object.fromEntries(
    Object.entries(obj).filter(([k]) => keys.includes(k as any))
  ) as any

/**
 * A default ID generator function that uses a custom alphabet based on
 * URL-safe symbols.
 */
export const defaultIDGeneratorFn: types.IDGeneratorFunction =
  customAlphabet(urlAlphabet)

export function createID(...prefixes: string[]): string {
  return [...prefixes, defaultIDGeneratorFn()].filter(Boolean).join(':')
}

export function getDebugMention(
  mention: types.TweetMention | types.PartialTweetMention
  // ...additionalFields: (keyof types.TweetMention)[]
): Partial<types.TweetMention> {
  return pick(
    mention,
    'id',
    'text',
    'prompt',
    'promptUrl',
    'isReply',
    'numFollowers',
    'priorityScore'
  )
}

/**
 * Converts a Tweet text string to a prompt ready for input to the answer engine.
 *
 * Strips usernames at the front of a tweet and URLs (like for embedding images).
 */
export function getPrompt(text = '', _?: types.Context): string {
  const prompt = text
    .trim()
    // strip leading usernames
    .replace(/^\s*@[a-zA-Z0-9_]+/g, '')
    .replace(/^\s*@[a-zA-Z0-9_]+/g, '')
    .replace(/^\s*@[a-zA-Z0-9_]+/g, '')
    .replace(/^\s*@[a-zA-Z0-9_]+/g, '')
    // strip twitter short urls
    .replace(rUrl, '')
    .trim()
    // strip leading commas which sometimes appear after usernames
    .replace(/^,\s*/, '')
    .trim()

  return prompt
}

const currentDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'full'
})

export function getCurrentDate(): string {
  return currentDateFormatter.format(new Date())
}
