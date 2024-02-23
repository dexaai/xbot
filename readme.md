<p>
  <a href="https://twitter.com/AskDexa"><img alt="@AskDexa on Twitter" src="https://img.shields.io/badge/twitter-@AskDexa-blue" /></a>
  <a href="https://github.com/dexaai/xbot/actions/workflows/test.yml"><img alt="Build Status" src="https://github.com/dexaai/xbot/actions/workflows/main.yml/badge.svg" /></a>
  <a href="https://github.com/dexaai/xbot/blob/main/license"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <a href="https://prettier.io"><img alt="Prettier Code Formatting" src="https://img.shields.io/badge/code_style-prettier-brightgreen.svg" /></a>
</p>

# X Bot <!-- omit from toc -->

> Twitter / X bot for responding to user mentions with AI-generated answers.

## Configuring the bot

You'll need a paid Twitter developer account and a Twitter v2 app with OAuth 2.0 enabled. You'll need to subscribe to at least the basic Twitter API plan in order to run this bot; **the free tier is not supported** since it doesn't support fetching tweets which is required for this bot to work.

Set up a `.env` file by copying `.env.example` and initializing all required environment variables.

Dependencies to call out:

- [Nango](https://www.nango.dev) is used to simplify Twitter OAuth
- [OpenAI](https://platform.openai.com/overview) chat completions API is used as the default answer engine for now
  - OpenAI's [moderations endpoint](https://platform.openai.com/docs/guides/moderation) is also used to filter out inappropriate tweets
- [Dexa](https://dexa.ai) is an excellent answer engine whose API is currently in private beta (otherwise it would be the default)
- [Redis](https://redis.io) is used to persist state across runs and cache twitter objects (tweets, users, mentions) in order to maximize our use of twitter API quotas
  - Redis is optional, and if you don't specify a redis instance, state will be "persisted" to an in-memory store
  - However, given twitter's quotas, using a redis instance to cache twitter objects is highly recommended

Note that setting `TWITTER_API_PLAN` to the correct plan is important, because all internal twitter throttling to avoid rate limits depends on your current plan.

## Running the bot

```bash
tsx bin/xbot.ts --help
```

```sh
Usage:
  xbot [flags...]

Flags:
  -a, --answer-engine <string>                      Answer engine to use (openai of dexa) (default: "openai")
      --debug                                       Enables debug logging
  -t, --debug-tweet-ids <string>                    Specifies a tweet to process instead of responding to mentions with
                                                    the default behavior. Multiple tweets ids can be specified (-t id1
                                                    -t id2 -t id3). Exits after processing the specified tweets.
  -d, --dry-run                                     Enables dry run mode, which will not tweet or make any POST requests
                                                    to twitter
  -e, --early-exit                                  Exits the program after resolving the first batch of mentions, but
                                                    without actually processing them or tweeting anything
  -f, --force-reply                                 Forces twitter mention validation to succeed, even if the bot has
                                                    already responded to a mention; very useful in combination with
                                                    --debug-tweet-ids
  -h, --help                                        Show help
  -n, --max-num-mentions-to-process <number>        Number of mentions to process per batch (default: 10)
      --no-mentions-cache                           Disables loading twitter mentions from the cache (which will always
                                                    hit the twitter api)
  -R, --resolve-all-mentions                        Bypasses the tweet mention cache and since mention id state to fetch
                                                    all mentions from the twitter api
  -s, --since-mention-id <string>                   Overrides the default since mention id
```

## TODO

- support quote tweet and retweet context
- support user entity context
- support blank tweet responses
  - eg, a user responds to somebody else's question with just `@AskDexa` and no other text
  - we currently ignore these as invalid, empty mentions, but if they're in response to another tweet that's valid, then we should handle them appropriately
- support URLs and other entity metadata (user profile info) so the answer engine has more info to work off of
- consider re-adding support for generating images to support longer responses w/ the openai answer engine
  - could use a binary classifier to determine whether or not to render the response as an image

## License

MIT © [Dexa](https://dexa.ai)
