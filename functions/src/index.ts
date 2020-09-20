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
  .schedule("every 2 minutes")
  .onRun((context) => {
    findAndRetweet();
    return null;
  });

export const runWithHttp = functions.https.onRequest(
  async (request, response) => {
    response.send("Running!");
    findAndRetweet();
  }
);

const findAndRetweet = () => {
  const stream = T.stream("statuses/sample", {
    tweet_mode: "extended",
  });

  setTimeout(() => {
    console.log("timed out, no tweet found");
    stream.stop();
  }, 0.5 * 60 * 1000);

  stream.on("tweet", function (tweet: any) {
    const analysis = analyzeTweet(tweet.text);
    if (analysis.score > config.minimumScore) {
      retweet(tweet.id_str);
      console.log("done");
      stream.stop();
    }
  });
  return null;
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
