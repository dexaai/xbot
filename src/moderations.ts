import './config.js'

import type * as types from './types.js'

const blockedRegexes = [
  /\bheil\s*hitler/gi,
  /\bnigg[ae]rs?\b/gi,
  /\bfagg?ots?\b/gi,
  /\bneger\b/gi,
  /\bschwuchteln?\b/gi,
  /\bhimmlers?\b/gi,
  /\bkanac?ken?\b/gi
]

export async function checkModeration(
  input = '',
  ctx: Pick<types.Context, 'openaiClient'>
): Promise<types.OpenAIModeration> {
  const inputL = input.toLowerCase().trim()
  for (const blockedRegex of blockedRegexes) {
    if (blockedRegex.test(inputL)) {
      return {
        flagged: true,
        categories: {
          hate: true
        },
        category_scores: {}
      } as types.OpenAIModeration
    }
  }

  const res = await ctx.openaiClient.moderations.create({
    input
  })

  return res.results[0]!
}
