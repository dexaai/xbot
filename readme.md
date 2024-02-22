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
tsx bin/index.ts
```

## TODO

- add generation json ability script for specific tweet ids
- support quote tweet and retweet context
- support URLs and other entity metadata (user profile info) so the answer engine has more info to work off of
- consider re-adding support for generating images to support longer responses w/ the openai answer engine

## License

MIT © [Dexa](https://dexa.ai)
