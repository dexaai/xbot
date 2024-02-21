<p>
  <a href="https://twitter.com/AskDexa"><img alt="@AskDexa on Twitter" src="https://img.shields.io/badge/twitter-blue" /></a>
  <a href="https://github.com/dexaai/xbot/actions/workflows/test.yml"><img alt="Build Status" src="https://github.com/dexaai/xbot/actions/workflows/main.yml/badge.svg" /></a>
  <a href="https://github.com/dexaai/xbot/blob/main/license"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <a href="https://prettier.io"><img alt="Prettier Code Formatting" src="https://img.shields.io/badge/code_style-prettier-brightgreen.svg" /></a>
</p>

# X Bot <!-- omit from toc -->

> Twitter / X bot which responds to user mentions with AI-generated answers.

## Configuring the bot

You'll need a Twitter developer account and a Twitter an app with OAuth 2.0 enabled.

Set up a `.env` file by copying `.env.example` and initializing all required environment variables.

Dependencies to call out:

- [Nango](https://www.nango.dev) is used to simplify Twitter OAuth
- [Dexa](https://dexa.ai) will soon become the default answer engine
- [OpenAI](https://platform.openai.com/overview) chat completions API is used as the default answer engine for now
- [Redis](https://redis.io) is used to persist state across runs and cache twitter objects (tweets, users, mentions) in order to maximize our use of twitter API quotas
  - Redis is optional, and if you don't specify a redis instance, state will be "persisted" to an in-memory store. However, given twitter's quotas, using a redis instance to cache twitter objects is highly recommended.

## Running the bot

```bash
tsx bin/index.ts
```

## TODO

- [Dexa](https://dexa.ai) answer engine
- re-add support for moderations
- re-add support for generating images to support longer responses

## License

MIT © [Dexa](https://dexa.ai)
