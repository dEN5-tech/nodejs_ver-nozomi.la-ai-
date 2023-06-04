const { POOL_SIZE, DEBUG } = require("./ai");
const { g } = require("./server");
const axios = require("axios");
const { Mutex } = require("async-mutex");
const { jspack } = require("jspack");

const MASTER_URL = "https://n.nozomi.la/index.nozomi";
const TAG_URL = "https://n.nozomi.la/nozomi/%s.nozomi";

const { FILTER } = require("./parameters");
const { store, imageWorkerSlice } = require("./state");
let baseUrl = MASTER_URL;
if (FILTER) {
  baseUrl = TAG_URL.replace("%s", FILTER);
}

async function askMaster(start, end) {
  const response = await axios({
    method: "get",
    url: baseUrl,
    responseType: "arraybuffer",
    headers: {
      authority: "n.nozomi.la",
      accept: "*/*",
      "accept-language":
        "en-US,en;q=0.5",
      "cache-control": "no-cache",
      origin: "https://nozomi.la",
      pragma: "no-cache",
      referer: "https://nozomi.la/",
      Range: `bytes=${start * 4}-${end * 4 - 1}`,
      "sec-ch-ua":
        '"Chromium";v="104", " Not A;Brand";v="99", "Google Chrome";v="104"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
  });

  const arr = new Uint8Array(response.data);
  const total = arr.length / 4;
  let post_ids = jspack.Unpack(total + "I", arr);
  return post_ids || [];
}

function urlJSON(doc_id_) {
  const doc_id = doc_id_.toString();
  const a = doc_id[doc_id.length - 1];
  const b = doc_id.substring(doc_id.length - 3, doc_id.length - 1);
  return `https://j.nozomi.la/post/${a}/${b}/${doc_id}.json`;
}

const getJSON = async function (doc_id) {
  if (doc_id) {
    const url = urlJSON(doc_id);
    try {
      const response = await axios({
        method: "get",
        url,
        responseType: "json",
        headers: {
          Host: "j.nozomi.la",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; rv:68.0) Gecko/20100101 Firefox/68.0",
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          Referer: "https://nozomi.la/",
          Origin: "https://nozomi.la",
          Connection: "keep-alive",
          TE: "Trailers",
        },
      });
      return response.data;
    } catch (error) {
      return null;
    }
  } else return null;
}

async function getImage(url) {
  const headers = {
    authority: "w.nozomi.la",
    accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "accept-language": "en-US;q=0.8,en;q=0.7,zh-CN;q=0.6,zh;q=0.5",
    "cache-control": "no-cache",
    pragma: "no-cache",
    referer: "https://nozomi.la/",
    "sec-ch-ua":
      '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "Windows",
    "sec-fetch-dest": "image",
    "sec-fetch-mode": "no-cors",
    "sec-fetch-site": "same-site",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  };

  const response = await axios.get(url, { headers });

  if (!response.data) {
    throw new Error("No image content received.");
  }

  return response.data;
}

class ImageWorker {
  constructor(url) {
    this.url = url;
    this.result = null;
    this.todo = null;
  }

  run() {
    if (DEBUG) {
      console.log('ImageWorker starts...');
    }

    // Simulating async getImage function
    getImage(this.url).then(content => {
      store.dispatch(imageWorkerSlice.actions.setResult(content));
      store.dispatch(imageWorkerSlice.actions.setRunning(true));
      g.printJobs();
      if (typeof this.todo === 'function') {
        this.todo();
      }
      if (DEBUG) {
        console.log('ImageWorker ends.');
      }
      store.dispatch(imageWorkerSlice.actions.setRunning(false));
    });

    store.dispatch(imageWorkerSlice.actions.setImageUrl(this.url));
  }

  setTodo(callback) {
    this.todo = callback;
  }
}


module.exports = { askMaster, getJSON, ImageWorker };
