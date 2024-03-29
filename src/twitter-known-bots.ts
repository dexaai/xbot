// These are stored as case-insensitive, lowercase strings
export const knownTwitterBotUsernames = new Set(
  [
    'threadreaderapp',
    'SaveToNotion',
    'readwiseio',
    'unrollthread',
    'ChatGPTBot',
    'AskDexa',
    'BigTechAlert',
    'TrumpsAlert',
    'PingThread',
    'threader',
    'ReplyGPT',
    'ChatSonicAI',
    'dustyplaylist',
    'pikaso_me',
    'RemindMe_OfThis',
    'SaveMyVideo',
    'QuotedReplies',
    'poet_this',
    'MakeItAQuote',
    'colorize_bot',
    'DearAssistant',
    'WhatTheFare',
    'wayback_exe',
    'TayTweets',
    'deepquestionbot',
    'MoMARobot',
    'phasechase',
    'poem_exe',
    'desires_exe',
    'HundredZeros',
    'dscovr_epic',
    'MagicRealismBot',
    'MuseumBot',
    'TwoHeadlines',
    'pentametron',
    'earthquakebot',
    '_grammar_',
    'netflix_bot',
    'redbox_bot',
    'nicetipsbot',
    'the_ephemerides',
    'year_progress',
    'IFindPlanets',
    'emojimashupbot',
    'translatorbot',
    'MetaculusAlert',
    'hashtagify',
    'GooogleFactss',
    'Timer',
    'DownloaderBot',
    'QuakesToday',
    'Savevidbot',
    'Growthoid',
    'greatartbot',
    'Stupidcounter',
    'everyword',
    'fuckeveryword',
    'big_ben_clock',
    'LetKanyeFinish',
    'RedScareBot',
    'EnjoyTheFilm',
    'DBZNappa',
    'Exosaurs',
    'exoslash',
    'BloombrgNewsish',
    'AutoCharts',
    'HottestStartups',
    'metaphorminute',
    'unchartedatlas',
    'YesYoureRacist',
    'YesYoureSexist',
    'accidental575',
    'EarthRoverBot',
    'happened_today',
    'anagramatron',
    'pentametron',
    'stealthmountain',
    'SortingBot',
    'flycolony',
    'chernobylstatus',
    'blitz_bot_test',
    'unescobot',
    'wahlumfrageBot',
    'NeonaziWallets',
    'LatencyAt',
    'teololstoy',
    'trumpretruth',
    'UnrollHelper',
    'bot4thread',
    'everylotnyc',
    '_restaurant_bot',
    '_weather_bot_',
    'everygoodfella',
    'ca_dmv_bot',
    'everycolor',
    'EmojiMashupBot',
    'tinycarebot',

    // Imported from https://github.com/orsifrancesco/twitter-bots-list
    'tiny_raindrops_',
    'twoemojicons',
    '5hmC_papers',
    '5adaybot',
    'BackyardBirdbot',
    'BigramPoetry',
    'Botgle',
    'ConceptNetPoet',
    'DailyDesiderata',
    'Diaeresis_OTPs',
    'EmojiStorms',
    'Trakl_Bot',
    'FireworksBot',
    'GTWhistle',
    'HaikuNewsBot',
    'Hangman_Bot',
    'HeadlineGifs',
    'HighStMarketBot',
    'Hitch_Haiku',
    'HypernymBot',
    'JaneAustenHaiku',
    'JoyOfBotRoss',
    'JudithBotler',
    'KeplerBot',
    'LetsPlayTrivia',
    'MelodyBot3456',
    'Moondogbot',
    'NixieBot',
    'OliverBarkBark',
    'OrbitOrbot',
    'PepitoTheCat',
    'Rene_Damaul',
    'RollDiceBot',
    'SymbolsBot',
    'TheGIFingBot',
    'TheRiddlerBot',
    'TilingBot',
    'TonightWeBot',
    'TresEnRayaBot',
    'TwinPeaksBot',
    'UC_Poesias_Bot',
    'VillanelleBot',
    'YouLookNiceBot',
    '_blackobs',
    '_daysuntilxmas',
    '_ku_bot',
    '_posibot',
    'accidental575',
    'acrotowne',
    'adventvrecall',
    'ahouseofdust',
    'an_entire_movie',
    'autoarspoetica',
    'boggle_bot',
    'botinthewoods',
    'bubble_bott/',
    'buoypix',
    'burnedyourtweet',
    'calm_gifs',
    'carlomarxbot',
    'chessbot2020',
    'coupletbot',
    'crowdpokerbot',
    'culturereusebot',
    'daphneflap',
    'dmvisbot',
    'dscovrnews',
    'earthin24',
    'eecummings_bot',
    'emoji_haiku',
    'emoji_jury',
    'face2pumpkin',
    'fearwantbot',
    'folderisempty',
    'gifmath',
    'glossatory',
    'goldenhourSEA',
    'goth_lyrics',
    'grow_slow',
    'haiku_ebooks',
    'haikuincidence',
    'haikumurakami',
    'haikuthegibson',
    'hypno__bot',
    'joculators',
    'letsplaysnake',
    'lettergamebot',
    'liketocontinue',
    'lovelivesbot',
    'lyinghammock',
    'mazingbot',
    'minetweeter_',
    'neuralgae',
    'nmstereo',
    'norppalivebot',
    'okay_campers',
    'p0em_bot',
    'pentametron',
    'playlightsout',
    'poem_exe',
    'poeticdevice',
    'poetranslator',
    'relaxagons',
    'rhymerobot',
    'roulettron',
    'smilevector',
    'sorrowjs',
    'soulscroll1',
    'spaceb07',
    'spindlewheelbot',
    'spinnymachine',
    'springy_bot',
    'tardygram',
    'theclivebot',
    'tiny_mssn_ctrl',
    'tinycolorpoems',
    'tinypoemgen',
    'titre_de_pornos',
    'trafficgifs',
    'trashcanlife',
    'tv_sounds',
    'tweetgameoflife',
    'unoforeveryone',
    'vidglitch',
    'wavy_bgs',
    'what_capital',
    'youreherebot',
    'a_lovely_cloud',
    'a_softer',
    'atinyzoo',
    'Motif_EpiFeed',
    'ANH_Papers',
    'headsandwings',
    'bot_abandoned',
    'adapmolevol',
    'AestheticBot_22',
    'asthma_papers',
    'AutophagyPapers',
    'typevpapers',
    'AwfulEmoji',
    'SecretionPapers',
    'BayBridgeWatch',
    'BehavEcolPapers',
    'big_ben_clock',
    'GatesJets',
    'emojipotus',
    'BioCodePapers',
    'bionet_papers',
    'biofilmPapers',
    'bioinfo_papers',
    'BioinformaticsP',
    'BioinfoPapers',
    'BtcBlockBot',
    'IAmBitcoinBot',
    'riverlevel_1867',
    'botlovesyou',
    'bot_ideas',
    'BotfonsNeedles',
    'botilius_syrus',
    'BrainDev_Papers',
    'COF_papers',
    'CRISPR_Articles',
    'CRISPR_papers',
    'CTCF_Papers',
    'POC_Papers',
    'CancerPapers',
    '_cawp_',
    'cat_poem',
    '_StalkBot',
    'CelebJets',
    'cellular_bot',
    'CentrosomePub',
    'ChessPuzzleBot',
    'cichlid_papers',
    'citiesatanangle',
    'BotClassroom',
    'colsci_papers',
    'colorize_bot',
    'CompBiolPapers',
    'Crypto3OT',
    'CultEvoBot',
    'cyclicdigmp',
    'DDWradar',
    'DLR_bot',
    'DNAtopologyBot',
    'DNA_RNA_Uni',
    'DNAbinding',
    'DadaistTwit',
    'DCell_papers',
    'DennyStreetCam',
    'TrumpRetruth',
    'MagaWorldTruth',
    'pendulum_bot',
    'dungeonideas',
    'emoji__polls',
    'EMR_research',
    'earthacrosstime',
    'EcoLog_L',
    'edgetics_papers',
    'ElizabethLn_bot',
    'elonjet',
    'EmojiMashupFace',
    'EmojiAquarium',
    'SurrogaDesigns',
    'emojiatlas',
    'EmojiBlend',
    'emojiforecast',
    'EmojiGenderBot',
    'EmojiMashupBot',
    'EmojiMeadow',
    'EmojiPrincesses',
    'EmojiSnakeGame',
    'EmojiTetra',
    'EmojiWeatherCA',
    'EmojiWeatherUSA',
    'emoji_dna',
    'emojiUSA',
    'EmojiPainter',
    'Emojimuseet',
    'EndlessJeopardy',
    'eng_papers',
    'loops_enhancers',
    'everycolorbot',
    'everyherd_bot',
    'EverySheriff',
    'EvoBehGe_papers',
    'evoldir',
    'rnomics',
    'FlagsMashupBot',
    'flags_of_flags',
    'fruitWormPapers',
    'lonesome_arcade',
    'fusopapers',
    'GPCRcomplex',
    'GWAS_lit',
    'GameDesignXpert',
    '3D_Genome',
    'GhostOfBotPast',
    'GifEarth',
    'HashflagArchive',
    'worm_papers',
    'HSC_papers',
    'BotThatSaysHi',
    'hotspot_papers',
    'BotHourly',
    'hypoxiapapers',
    'ArxivBot',
    'ilovethisbot',
    'IDP_papers',
    'IT_papers',
    'Immunol_papers',
    'InchydoneyCam',
    'dailyinvaders',
    'goTakeThis',
    'LettsScience',
    'JC_pathogenomic',
    'dinosaur_finder',
    'JustDiedBot',
    'TE_papers',
    'KimbalJet',
    'leastUsedEmoji',
    'legotracker',
    'legospacebot',
    'Linux__Bot',
    'litscraper',
    'LitterBoxTweets',
    'tflstatusnow',
    'ASplant_papers',
    'MOF_papers',
    'MltplSclppr',
    'EmojiRoundabout',
    'MakeItAQuote',
    'mestroubles',
    'preprints_metab',
    'metagenomic_lit',
    'metagenomics',
    'MoaiEmojiBot',
    'EmojiMoodBot',
    'NDM_Papers',
    'NintendoArtBot',
    'NK_papers',
    'NRPS_papers',
    'nyplemoji',
    'NatureArticles',
    'Nematode_papers',
    'NeuroGen_papers',
    'NeurogeneticsL',
    'solidstateNMR',
    'nightsky_bot',
    'NiteAlps',
    'NoEmojiForThis',
    'nonogram_bot',
    'Nucleosome_Bot',
    'ominouszoom',
    'OvvO_bot',
    'pacman_poetry',
    'par_papers',
    'GlcNAcMurNAc',
    'phagepapers',
    'CrisprPhages',
    'Pha_Tran_Papers',
    'Pothole_Bot',
    'PlantEcologyBot',
    'polyqr_papers',
    'pooledseq',
    'Popgen_Papers',
    'PreprintBot',
    'prideflagbot',
    'PrintShopDeluxe',
    'DilemmaBot',
    'PromPreprint',
    'PubSnips',
    'QIMRBergh_pubs',
    'BioPapers',
    'RNAMaker',
    'RNAi_papers',
    'RNApreprints',
    'ThreeBodyBot',
    'ribosome_papers',
    'RoadTripBot_',
    'RobotWalks',
    'rockallisland',
    'RootPapers',
    'duckyeveryhour',
    'PutinJet',
    'fallingleafbot',
    'swisnf',
    'MuscleStemCell',
    'botarchaeo',
    'scell_papers',
    'sRNAPapers',
    'SmoothUnicode',
    'FeedSnakeBot',
    'SpaceTfrs',
    'cute_space_bot',
    'sponge_papers',
    'starnearyou',
    'Strep_papers',
    'sunriseskiesnyc',
    'SRMicro_papers',
    'Symbiosispapers',
    'cancerSL',
    'T3SS2',
    'TC_papers',
    'TF_binding_bot',
    'TweetMe4Moji',
    'tarojibot',
    'thetrumpwatcher',
    'USdumpsterfire',
    'EmojiLoveBot',
    'PlayTTTBot',
    'time_until_xmas',
    'TinyDungeons',
    'tiny_forests',
    'thetinygallery',
    'tinylittlehomes',
    'TinyPettingZoo',
    'tinyprideparade',
    'TinyProtests',
    'LondonTram_bot',
    'transcriptomes',
    'TransxnNoiseBot',
    'TumorImm_papers',
    'turtles_down',
    'tweetthetube',
    'PlayGamesBot',
    'TweteoSwiss',
    'UnicodeTweet',
    'wrap_papers',
    'VEGFRSSfeeds',
    'VastAndStarlit',
    'viewfromroots',
    'mitosis_papers',
    'vitamin_A_paper',
    'vroom_vroom_bot',
    'WeirdSatellite',
    'wheelsonthebot',
    'WntPublications',
    'WritersBlockBot',
    'Zeolite_papers',
    'thezootrain',
    'ZuccJet',
    'emojitoemoji',
    '_emo_ji',
    'aDNA_papers',
    'arXiv_grqc',
    'biorxiv_bioinfo',
    'biorxiv_biophys',
    'biorxiv_cellbio',
    'biorxiv_ecology',
    'biorxiv_evobio',
    'biorxiv_genetic',
    'biorxiv_genomic',
    'biorxiv_micrbio',
    'biorxiv_neursci',
    'biorxiv_plants',
    'biorxiv_pubd',
    'biorxiv_sysbio',
    'blackletterwalk',
    'bon_appetiny',
    'bxv_biochem',
    'bxv_cell',
    'bxv_microbiol',
    'bxv_molbiol',
    'canberramapbot',
    'censusAmericans',
    'chemotaxisrss',
    'cohesin_papers',
    'cryoEM_Papers',
    'cryptic_slogans',
    'digital_henge',
    'eQTL_papers',
    'effdeeemmu',
    'EmojiAstro',
    'emoji_pizzas',
    'emojitracks',
    'emojiMountain',
    'emojipicbot',
    'epigen_papers',
    'everygothcolor',
    'everyblendbot',
    'everylotMVD',
    'faceoffbot',
    'vexillographing',
    'fly_papers',
    'functionalemoji',
    'glycopreprint',
    'goodnukltatbot',
    'gyr_papers',
    'genderposibot',
    'infinitedeserts',
    'lncRNA_papers',
    'londonmapbot',
    'meiosis_papers',
    'memprot_biophys',
    'microRNA_papers',
    'forestgen',
    'phylogeo_papers',
    'phy_papers',
    'PlantBiologyNSP',
    'pollockdotexe',
    'psd2ohtml',
    'pseudo_papers',
    'regulon_papers',
    'Ro_Sham_Bot',
    'scientificpaper',
    'sc_papers',
    'strangeattrbot',
    'sunrisebot',
    'synbio_papers',
    'theairplane_bot',
    'tiny_astro_naut',
    'tiny_bus_stop',
    'tiny_cityscapes',
    'tiny_cottages',
    'tiny_gardens',
    'thetinyladybug',
    'tiny_reefs',
    'tiny_seascape',
    'tiny_street',
    'tiny_treelines',
    'tiny__forest',
    'tiny_gravity',
    'Littlelandscap2',
    'topbiopapers',
    'choochoobot/',
    'trendingpalette',
    'UfklBot',
    'unicode_garden',
    'sunrise_EH10',
    'virus_genome',
    'xorTriangles',
    'yeast_papers',
    'IAmDogeBot',
    'SnakeGameBot',
    'lycanthrobot',
    'pls_take_breaks',
    'winter_scapes',
    'tiny_seas',
    'Emojiforest',
    'ClappinessBot',
    'R_loop_papers',
    'tiny_map'
  ].map((s) => s.toLowerCase())
)

export function isKnownTwitterBotUsername(username: string) {
  return knownTwitterBotUsernames.has(username.toLowerCase())
}

export function isLikelyTwitterBotUsername(username: string) {
  username = username.toLowerCase()

  if (isKnownTwitterBotUsername(username)) return true
  if (/bot$/.test(username)) return true
  if (/gpt$/.test(username)) return true
  if (/status$/.test(username)) return true

  return false
}
