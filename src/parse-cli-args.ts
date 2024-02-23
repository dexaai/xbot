import { cli } from 'cleye'

import * as config from './config.js'

export function parseCLIArgs(
  overrides?: Record<string, any>,
  argv: string[] = process.argv
) {
  return cli(
    {
      name: overrides?.name ?? 'xbot',
      parameters: [],
      flags: {
        debug: {
          type: Boolean,
          description: 'Enables debug logging',
          default: overrides?.debug ?? false
        },
        dryRun: {
          type: Boolean,
          description:
            'Enables dry run mode, which will not tweet or make any POST requests to twitter',
          alias: 'd',
          default: overrides?.dryRun ?? false
        },
        noMentionsCache: {
          type: Boolean,
          description:
            'Disables loading twitter mentions from the cache (which will always hit the twitter api)',
          default: overrides?.noMentionsCache ?? false
        },
        earlyExit: {
          type: Boolean,
          description:
            'Exits the program after resolving the first batch of mentions, but without actually processing them or tweeting anything',
          alias: 'e',
          default: overrides?.earlyExit ?? false
        },
        forceReply: {
          type: Boolean,
          description:
            'Forces twitter mention validation to succeed, even if the bot has already responded to a mention; very useful in combination with --debug-tweet-ids',
          alias: 'f',
          default: overrides?.forceReply ?? false
        },
        resolveAllMentions: {
          type: Boolean,
          description:
            'Bypasses the tweet mention cache and since mention id state to fetch all mentions from the twitter api',
          alias: 'R',
          default: overrides?.resolveAllMentions ?? false
        },
        debugTweetIds: {
          type: [String],
          description:
            'Specifies a tweet to process instead of responding to mentions with the default behavior. Multiple tweets ids can be specified (-t id1 -t id2 -t id3). Exits after processing the specified tweets.',
          alias: 't'
        },
        sinceMentionId: {
          type: String,
          description: 'Overrides the default since mention id',
          alias: 's',
          default: overrides?.sinceMentionId ?? undefined
        },
        maxNumMentionsToProcess: {
          type: Number,
          description: 'Number of mentions to process per batch',
          alias: 'n',
          default:
            overrides?.maxNumMentionsToProcess ??
            config.defaultMaxNumMentionsToProcessPerBatch
        },
        answerEngine: {
          type: String,
          description: 'Answer engine to use (openai, dexa, or perplexity)',
          alias: 'a',
          default: overrides?.answerEngine ?? config.defaultAnswerEngineType
        }
      }
    },
    () => {},
    argv
  )
}
