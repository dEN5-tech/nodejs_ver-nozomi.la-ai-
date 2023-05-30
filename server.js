const express = require('express');
const { Worker } = require('worker_threads');
const { ALL_RESPONSES, recordResponse } = require('./ai');
const { JOB_POOL_SIZE, PORT, HOST } = require('./parameters');
const fs = require('fs');
const path = require('path');
const { Mutex, Semaphore } = require('async-mutex');

const trusted_ip = [];

const Job = function (doc, imageWorker, mode) {
  this.doc = doc;
  this.imageWorker = imageWorker;
  this.mode = mode;
};

class G {
  constructor() {
    this.conSem = new Semaphore(JOB_POOL_SIZE);
    this.proSem = new Semaphore(JOB_POOL_SIZE);
    this.jobsLock = new Mutex();
    this.jobs = [];

    (async () => {
      for (let i = 0; i < JOB_POOL_SIZE; i++) {
        await this.conSem.acquire();
      }
    })();
  }

  printJobs() {
    this.jobsLock.acquire().then((release) => {
      console.log('jobs', this.jobs.map((x) => (x.imageWorker.result !== null ? 'I' : '_')));
      release();
    });
  }
}

const g = new G();

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'front', 'index.html');
  res.sendFile(filePath);
});

app.get('/next', async (req, res) => {
  const job = await g.conSem.acquire();
  const { doc, imageWorker, mode } = job;
  const _id = doc.id;
  const _mode = mode;
  res.json({
    doc_id: _id,
    mode: _mode,
    artists: doc.getArtists(),
    tags: doc.getTags(),
  });
});

app.get('/response', async (req, res) => {
  const doc_id = req.query.doc_id;
  const response = req.query.response;
  await g.jobsLock.acquire();
  let index;
  for (let i = 0; i < g.jobs.length; i++) {
    if (g.jobs[i].doc.id === doc_id) {
      index = i;
      break;
    }
  }
  const { doc, imageWorker } = g.jobs.splice(index, 1)[0];
  g.printJobs();
  g.proSem.release();
  new Worker(recordResponse, {
    workerData: {
      response,
      doc,
      imageWorkerResult: imageWorker.result,
    },
  }).postMessage('start');
  res.send('ok');
  g.jobsLock.release();
});

app.get('/img', async (req, res) => {
  const doc_id = req.query.doc_id;
  await g.jobsLock.acquire();
  let doc, imageWorker;
  for (const job of g.jobs) {
    if (job.doc.id === doc_id) {
      doc = job.doc;
      imageWorker = job.imageWorker;
      break;
    }
  }
  if (imageWorker.result === null) {
    res.json({ error: true });
  } else {
    res.send(imageWorker.result);
  }
  g.jobsLock.release();
});

app.post('/add_to_blacklist', (req, res) => {
  const tag = req.body.tag;
  fs.appendFileSync('blacklist.txt', tag + '\n');
  res.json({ message: 'Tag added to the blacklist.' });
});

function startServer() {
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

module.exports = {
  startServer,
};
