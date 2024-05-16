import '../src/config.js'

import pMap from 'p-map'

import { ScraperClient } from '../src/services/scraper-client.js'
import { omit } from '../src/utils.js'

/**
 * Scratchpad / playground for testing the ScraperClient.
 */
async function main() {
  const scraperClient = new ScraperClient()

  const urls = [
    'https://www.nytimes.com/2023/05/31/magazine/ai-start-up-accelerator-san-francisco.html',
    'https://www.youtube.com/watch?v=NNgdcn4Ux1k&ab_channel=LexClips',
    'https://digg.com/memes-ranked/link/best-memes-ranked-pussy-in-bio-mandela-effect-room-space?utm_source=digg',
    'https://platform.openai.com/docs/guides/vision',
    'https://en.wikipedia.org/wiki/Larry_Page',
    'https://www.flowrestling.org/articles/12162675-oklahoma-state-wrestling-on-the-hunt-for-upsets-against-iowa',
    'https://github.com/transitive-bullshit/lqip-modern',
    'https://www.gatesnotes.com/AI-agents',
    'https://blog.eladgil.com/p/early-days-of-ai',
    'https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/',
    'https://www.bbc.com/news/business-68387018',
    'https://www.bbc.com/sport/football/68395310',
    'https://www.kayak.com/',
    'https://marmelab.com/blog/2024/01/23/react-19-new-hooks.html?ref=labnotes.org',
    'https://www.foxnews.com/us/ai-technology-could-help-us-allies-monitor-chinas-taiwan-invasion-intensions',
    'https://twitter.com/paulg/status/1761731253764579573',
    'https://twitter.com/transitive_bs',
    'https://transitivebullsh.it/chatgpt-twitter-bot-lessons',
    'https://www.swyx.io/learn-in-public',
    'https://leerob.io/blog/developer-experience-examples',
    'https://rauchg.com/2021/making-the-web-faster',
    'https://blog.google/products/gemini/bard-gemini-advanced-app/',
    'https://apnews.com/article/2024-qatar-swimming-worlds-underwater-camera-splash',
    'https://www.amazon.com/Deepness-Sky-Zones-Thought-Book-ebook/dp/B002H8ORKM/?_encoding=UTF8&pd_rd_w=4N09q&content-id=amzn1.sym.379956f8-690b-4143-ad17-ba606cbec0c1&pf_rd_p=379956f8-690b-4143-ad17-ba606cbec0c1&pf_rd_r=NXZSG4MAQ5P40FP5T5ZR&pd_rd_wg=t7KmU&pd_rd_r=5c051a29-61a2-468a-bc68-ad2754e52d05&ref_=pd_gw_bmx27b',
    'https://www.reddit.com/r/MadeMeSmile/comments/u33nuc/he_finally_got_his_acorn/',
    'https://www.reddit.com/r/Damnthatsinteresting/comments/ujl32z/this_is_jeanbaptiste_kempf_the_creator_of_vlc/',
    'https://news.ycombinator.com/item?id=35154527',
    'https://news.ycombinator.com/item?id=11116274',
    'https://www.bbc.com/news/uk-43396008',
    'https://www.apple.com/customer-letter/',
    'https://openai.com/blog/openai-announces-leadership-transition',
    'https://www.apple.com/stevejobs/', // output includes some weird #{ref} stuff
    'https://groups.google.com/g/vim_announce/c/tWahca9zkt4?pli=1',
    'https://bensbites.beehiiv.com/',
    'https://bensbites.beehiiv.com/p/open-ai-serious-building-new-app-store',
    'https://anilist.co/anime/1/Cowboy-Bebop/',
    'https://dexa.ai/',
    'https://dexa.ai/s/S7RDMg3f',
    'https://www.quora.com/What-can-I-learn-know-right-now-in-10-minutes-that-will-be-useful-for-the-rest-of-my-life',
    'https://www.quora.com/How-do-top-students-study',
    'https://www.quora.com/What-are-the-most-surreal-places-to-visit',
    'https://www.instagram.com/p/BTKd8z2jM14/?img_index=1',
    'https://www.linkedin.com/in/fisch2/',
    'https://www.facebook.com/zuck/',
    'https://github.com/sindresorhus',
    'https://www.pornhub.com/',
    'https://www.tiktok.com/@zachking/video/6768504823336815877?embed_source=71929438%2C121374463%2C121351166%2C121331973%2C120811592%2C120810756%3Bnull%3Bembed_blank&refer=embed&referer_url=metricool.com%2Ftiktoks-most-viral-videos%2F&referer_video_id=6768504823336815877',
    'https://www.tiktok.com/@zachking/video/6749520869598481669'
  ]

  const results = (
    await pMap(
      urls,
      async (url) => {
        try {
          return await scraperClient.scrapeUrl(url)
        } catch (err: any) {
          console.error('error processing url', url, err.toString())
        }
      },
      {
        concurrency: 4
      }
    )
  ).filter(Boolean)

  console.log(
    JSON.stringify(
      results.map((res) => omit(res, 'content', 'rawHtml')),
      null,
      2
    )
  )
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
