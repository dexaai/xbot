import { expect, test } from 'vitest'

import { mergeEntityMaps } from './entities.js'

test('mergeEntityMaps', () => {
  expect(
    mergeEntityMaps(
      {},
      {
        users: {
          '327034465': {
            type: 'user',
            name: 'Travis Fischer',
            twitterId: '327034465',
            twitterUsername: 'transitive_bs',
            twitterBio:
              'Building AI agents and OSS projects like @ChatGPTBot. Prev: @microsoft, @amazon, saasify. My heart is open source 💕',
            twitterUrl: 'https://transitivebullsh.it',
            twitterPinnedTweetId: '1643017583917174784',
            twitterLocation: 'HF0',
            twitterProfileImageUrl:
              'https://pbs.twimg.com/profile_images/1347656662463766529/igIs8izN_normal.png',
            twitterNumFollowers: 17775,
            twitterNumFollowing: 701,
            twitterNumTweets: 7203,
            twitterNumLikes: 17775,
            urls: [
              {
                type: 'url',
                url: 'https://transitivebullsh.it',
                shortUrl: 'https://t.co/U7qFLMXw8R'
              }
            ]
          },
          '1235525929335689217': {
            type: 'user',
            name: 'Lofi Grind',
            twitterId: '1235525929335689217',
            twitterUsername: 'LofiGrind',
            twitterBio:
              'Chill ambient beats for when you wanna relax / study / grind.',
            twitterLocation: 'Brooklyn, NY',
            twitterProfileImageUrl:
              'https://pbs.twimg.com/profile_images/1235530549067943937/6BQE9kbQ_normal.jpg',
            twitterNumFollowers: 16,
            twitterNumFollowing: 35,
            twitterNumTweets: 436,
            twitterNumLikes: 16,
            urls: []
          }
        },
        tweets: {
          '1760384146004996333': {
            type: 'tweet',
            id: '1760384146004996333',
            authorId: '1235525929335689217',
            text: '@transitive_bs @LofiGrind explain this 👀',
            lang: 'en',
            repliedToTweetId: '1734782745799282820',
            repliedToUserId: '327034465',
            numLikes: 0,
            numRetweets: 0,
            numQuoteTweets: 0,
            numReplies: 6,
            numImpressions: 16
          }
        }
      },
      {},
      {}
    )
  ).toMatchSnapshot()

  expect(
    mergeEntityMaps(
      {
        users: {
          '327034465': {} as any
        },
        tweets: {
          '1760384146004996333': {} as any
        }
      },
      {
        users: {
          '1235525929335689217': {} as any
        },
        tweets: {
          '1760384146004996333': {} as any,
          test: {} as any
        }
      }
    )
  ).toMatchSnapshot()
})
