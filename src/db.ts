import KeyvRedis from '@keyv/redis'
import { type Redis } from 'ioredis'
import Keyv from 'keyv'

import * as config from './config.js'

// Used for caching twitter tweet objects
let tweets: Keyv

// Used for caching twitter user objects
let users: Keyv

// Used for storing bot response messages
let messages: Keyv

// Used for storing general bot state (e.g. most recent tweet id processed)
let state: Keyv

// NOTE: this should be a global to ensure it persists across serverless
// function invocations (if deployed in a serverless setting)
let redis: Redis

if (config.redisUrl) {
  const store = new KeyvRedis(config.redisUrl)
  redis = store.redis as Redis

  tweets = new Keyv({ store, namespace: config.redisNamespaceTweets })
  users = new Keyv({ store, namespace: config.redisNamespaceUsers })
  messages = new Keyv({ store, namespace: config.redisNamespaceMessages })
  state = new Keyv({ store, namespace: config.redisNamespaceState })
} else {
  console.warn('Redis is disabled. All state will be stored in memory.')

  tweets = new Keyv({ namespace: config.redisNamespaceTweets })
  users = new Keyv({ namespace: config.redisNamespaceUsers })
  messages = new Keyv({ namespace: config.redisNamespaceMessages })
  state = new Keyv({ namespace: config.redisNamespaceState })
}

export { tweets, users, messages, state }
