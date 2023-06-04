const { Doc, Tag, DocNotSuitable } = require("./doc");
const database = require("./database");
const { getJSON, askMaster, ImageWorker, PageOutOfRange } = require("./nozo");
const { forceMap } = require("./forcemap");

function random() {
  return Math.random();
}

const {
  DEBUG,
  START_EPOCH,
  EXPLORE_PROB,
  POOL_SIZE,
  JSON_MAX,
  VIEW_RATIO,
  ATTITUDE_TOWARDS_NOVEL_TAGS,
} = require("./parameters");
const { Job, g } = require("./server");

const RES_NEGATIVE = "RES_NEGATIVE";
const RES_FINE = "RES_FINE";
const RES_BETTER = "RES_BETTER";
const RES_MORE = "RES_MORE";
const RES_WOW = "RES_WOW";
const RES_SAVE = "RES_SAVE";

const ALL_RESPONSES = [
  RES_NEGATIVE,
  RES_FINE,
  RES_BETTER,
  RES_MORE,
  RES_WOW,
  RES_SAVE,
];

const SCORE = {
  [RES_NEGATIVE]: -2,
  [RES_FINE]: 0,
  [RES_BETTER]: 1,
  [RES_MORE]: 2,
  [RES_WOW]: 8,
  [RES_SAVE]: 20,
};

const WEIGHT = {
  artist: 4,
  character: 2,
};

const EXPLOIT = "EXPLOIT";
const EXPLORE = "EXPLORE";

const blacklist = [];

const recordResponse = (response, doc, img) => {
  if (database.doExist(database.DOCS, doc.id)) {
    throw new Error("Error 2049284234");
  }
  doc.response = response;
  database.saveDoc(doc);
  database.accOverall(response);
  for (const tag of doc.tags) {
    database.accTagInfo(tag, response);
    if (DEBUG) {
      console.log(database.loadTagInfo(tag.name));
    }
  }
  console.log(doc);
  if (response === RES_SAVE) {
    database.saveImg(doc, [img]);
  }
};

const score = (n_responses) => {
  let sum = 0;
  for (const response of ALL_RESPONSES) {
    sum += n_responses[response] || 0;
  }
  if (sum < 0.5) {
    return ATTITUDE_TOWARDS_NOVEL_TAGS;
  }
  let score = 0;
  for (const response of ALL_RESPONSES) {
    const n = n_responses[response] || 0;
    score += (n / sum) * SCORE[response];
  }
  return score;
};

const predict = (doc) => {
  const overall = database.loadOverall();
  let score_baseline;
  try {
    score_baseline = score(overall);
  } catch (error) {
    score_baseline = 0;
  }

  let result = 0;
  for (const tag of doc.tags) {
    let tagInfo;
    try {
      tagInfo = database.loadTagInfo(tag.name);
    } catch (error) {
      database.saveNewTagInfo(tag);
      tagInfo = database.loadTagInfo(tag.name);
    }
    let goodness;
    try {
      goodness = score(tagInfo.n_responses) - score_baseline;
    } catch (error) {
      goodness = 0;
    }
    goodness *= WEIGHT[tag.type] || 1;
    const _sum = tagInfo.sum();
    if (_sum < 5) {
      goodness *= _sum / 5;
    }
    result += goodness;
  }
  if (DEBUG) {
    console.log("predict", doc.id, result);
  }
  return result;
};

const sample = async (population) => {
  if (random() < EXPLORE_PROB) {
    // Explore
    const doc_id = population[Math.floor(Math.random() * population.length)];
    return [doc_id, EXPLORE];
  } else {
    // Exploit
    const jsons = await Promise.all(population.map((x) => getJSON(x)));
    const docs = [];
    for (const j of jsons) {
      try {
        docs.push(new Doc(j));
      } catch (error) {
        continue;
      }
    }
    const y_hats = docs.map((x) => [x.id, predict(x)]);
    const highscore = Math.max(...y_hats.map(([x, y]) => y));
    const results = y_hats
      .filter(([x, y]) => y === highscore)
      .map(([x, y]) => x);
    return [results[0], EXPLOIT];
  }
};

const roll = async () => {
  console.log("blacklist is", blacklist);
  console.log(
    "If at least one of them shows up in a doc, the doc will not show up, not even in EXPLORE mode."
  );
  let epoch = START_EPOCH;
  let epoch_step = 1;
  let patient = 1;
  const traversed = {};
  while (true) {
    let has_stuff = false;
    if (!traversed[epoch]) {
      console.log("epoch", epoch);
      traversed[epoch] = true;
      let pool;
      try {
        pool = await askMaster(epoch * POOL_SIZE, (epoch + 1) * POOL_SIZE);
        if (!Array.isArray(pool)) {
          throw new Error("Received pool is not an array.");
        }
      } catch (error) {
        console.log("There is no more. Enter to quit...");
        return;
      }
      let population = pool.filter((x) => !database.doExist(database.DOCS, x));
      let checked_404 = false;
      while (population.length >= pool.length * (1 - VIEW_RATIO)) {
        if (!checked_404) {
          const jsons = await Promise.all(population.map((x) => getJSON(x)));
          population = population.filter((x, index) => jsons[index] !== null);
          checked_404 = true;
          if (!population.length) {
            console.log("There is no more. Enter to quit...");
            return;
          }
          continue;
        }
        has_stuff = true;
        const [doc_id, mode] = await sample(population);
        population.splice(population.indexOf(doc_id), 1);
        let doc;
        try {
          doc = new Doc(await getJSON(doc_id));
        } catch (error) {
          console.log(error,doc_id)
          continue;
        }
        if (isBlacklisted(doc)) {
          console.log("continue isBlacklisted")
          continue;
        }
        if (DEBUG) {
          console.log("Waiting for proSem...");
        }
        if (DEBUG) {
          console.log("proSem acquired");
        }
        console.log("job")
        const job = new Job(doc, new ImageWorker(doc.img_urls[0]), mode);
        g.jobs.push(job);
        g.printJobs();
        job.imageWorker.run();
      }
    }
    if (has_stuff) {
      patient = 1;
      if (epoch_step !== 1) {
        epoch -= epoch_step - 1;
        epoch_step = 1;
      } else {
        epoch_step += 1;
        epoch_step = Math.min(15, epoch_step);
      }
    } else {
      if (patient === 1) {
        patient = 0;
      } else {
        epoch_step *= 2;
        if (random() < 0.3) {
          epoch -= Math.floor(Math.random() * epoch_step);
        }
      }
      epoch += epoch_step;
    }
  }
};

const setBlackList = (bl) => {
  blacklist.length = 0;
  blacklist.push(...bl);
};

const isBlacklisted = (doc) => {
  try {
    for (const tag of doc.tags) {
      if (blacklist.includes(tag.name)) {
        console.log(doc.id, "is blacklisted for having", tag.name);
        return true;
      }
    }
  } catch (error) {
    // Ignore DocNotSuitable error
  }
  return false;
};

module.exports = {
  recordResponse,
  roll,
  setBlackList,
  isBlacklisted,
  ALL_RESPONSES
};
