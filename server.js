const express = require("express");
const { Worker } = require("worker_threads");
const { ALL_RESPONSES } = require("./ai");
const { JOB_POOL_SIZE, PORT, HOST } = require("./parameters");
const fs = require("fs");
const path = require("path");
const { store } = require("./state");
const database = require("./database");


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

const Job = function (doc, imageWorker, mode) {
  this.doc = doc;
  this.imageWorker = imageWorker;
  this.mode = mode;

  this.setTodo = function (callback) {
    this.todo = callback;
  };
};

class G {
  constructor() {
    this.jobs = [];
  }

  printJobs() {
    console.log(
      "jobs",
      this.jobs.map((x) => (x.imageWorker.result !== null ? "I" : "_"))
    );
  }
}

const g = new G();

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "front", "index.html");
  res.sendFile(filePath);
});

app.get("/next", async (req, res) => {
  while (true) {
    const data = g.jobs.shift();
    if (data) {
      const {doc,imageWorker, mode} = data
      return res.json({
        doc_id: doc.id,
        mode: mode,
        artists: doc.getArtists(),
        tags: doc.getTags(),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for 1 second before checking again
  }
});

app.get("/response", async (req, res) => {
  const doc_id = req.query.doc_id;
  const response = req.query.response;
  const index = g.jobs.findIndex((job) => job.doc.id === doc_id);
  const { doc, imageWorker } = g.jobs.splice(index, 1)[0];
  g.printJobs();
  recordResponse( response, doc,imageWorker.result);
  res.send("ok");
});

app.get('/img', async (req, res) => {
  try {
    const job = store.getState();
    
    // Set header for image
    res.set('Content-Type', 'image/jpeg');
    
    res.send(job.result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: true });
  }
});



app.post("/add_to_blacklist", (req, res) => {
  const tag = req.body.tag;
  fs.appendFileSync("blacklist.txt", tag + "\n");
  res.json({ message: "Tag added to the blacklist." });
});

function startServer() {
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

module.exports = {
  startServer,
  Job,
  g,
};
