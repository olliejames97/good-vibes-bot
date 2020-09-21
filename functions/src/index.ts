import * as functions from "firebase-functions";
import { config } from "./config";
const Sentiment = require("sentiment");
const Twit = require("twit");
const LanguageDetect = require("languagedetect");

const lngDetector = new LanguageDetect();
const sentiment = new Sentiment();
const T = new Twit({
  consumer_key: config.keys.consumer,
  consumer_secret: config.keys.consumerSecret,
  access_token: config.keys.access,
  access_token_secret: config.keys.accessSecret,
  timeout_ms: 60 * 1000,
});

exports.scheduledFunction = functions.pubsub
  .schedule("every 4 minutes")
  .onRun((context) => {
    console.log("running");
    findAndRetweet().catch(console.error);
    return null;
  });

export const runWithHttp = functions.https.onRequest(
  async (request, response) => {
    findAndRetweet().catch(console.error);

    console.log("done streaming");
  }
);

const findAndRetweet = async () => {
  const stream = T.stream("statuses/sample", {
    tweet_mode: "extended",
  });
  let retweeted: null | { tweetId: string; text: string } = null;

  stream.on("tweet", function (tweet: any) {
    const analysis = analyzeTweet(tweet.text);
    if (analysis.score > config.minimumScore) {
      retweet(tweet.id_str);
      stream.stop();
      retweeted = {
        tweetId: tweet.id_str as string,
        text: tweet.text as string,
      };
    }
  });

  setTimeout(() => {
    console.log("done", retweeted);
    stream.stop();
    return retweeted;
  }, 2 * 60 * 1000);
};

const retweet = (id: string) => {
  return T.post("statuses/retweet/:id", { id }, function (
    err: any,
    data: any,
    response: any
  ) {
    if (err) {
      console.error(err);
      return;
    }
    console.log("retweeted", id);
  });
};
const analyzeTweet = (
  text: string
): {
  score: number;
} => {
  const sentimentResult = sentiment.analyze(text);
  const languageResult = lngDetector.detect(text, 1);
  let score = sentimentResult.score;
  if (
    !languageResult ||
    !languageResult[0] ||
    languageResult[0].length < 1 ||
    (languageResult[0] && languageResult[0][0] !== "english") ||
    text.startsWith("RT ") ||
    text.includes("@") ||
    text.includes("http://") ||
    text.includes("https://") ||
    sentimentResult.positive.length < 2
  ) {
    score = 0;
  }
  return { score };
};
