const fs = require('fs');
const { getImage } = require('./nozo');
const { TagInfo } = require('./tag');
const { ALL_RESPONSES, DEBUG } = require('./ai');
const { Mutex } = require('async-mutex');

const DOCS = 'docs';
const IMGS = 'imgs';
const TAGS = 'tags';
const OVERALL = 'overall.pickle';

const fileLock = new Mutex();
const accLock = new Mutex();

const listAll = (x) => {
  return fs.readdirSync(x);
};

const saveImg = (doc, imgs) => {
  doc.local_filenames = [];
  for (let i = 0; i < imgs.length; i++) {
    const content = imgs[i];
    const filename = `${doc.id}_${i}.${doc.img_type}`;
    fs.writeFileSync(`${IMGS}/${filename}`, content);
    doc.local_filenames.push(filename);
  }
};

const saveDoc = (doc) => {
  fs.writeFileSync(`${DOCS}/${doc.id}`, JSON.stringify(doc));
};

const loadDoc = (doc_id) => {
  const data = fs.readFileSync(`${DOCS}/${doc_id}`);
  return JSON.parse(data);
};

const legalizeTagName = (name) => {
  let result = '';
  for (let i = 0; i < name.length; i++) {
    const char = name[i];
    if (char.match(/[a-zA-Z0-9_]/)) {
      result += char;
    } else {
      result += String.fromCharCode(char.charCodeAt(0));
    }
  }
  return result;
};

const loadTagInfo = (name) => {
  const filePath = `${TAGS}/${legalizeTagName(name)}`;
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
};

const saveTagInfo = (tagInfo) => {
  const filePath = `${TAGS}/${legalizeTagName(tagInfo.name)}`;
  fs.writeFileSync(filePath, JSON.stringify(tagInfo));
};

const accTagInfo = async (tag, response) => {
  await accLock.acquire();
  try {
    const tagInfo = loadTagInfo(tag.name);
    tagInfo.n_responses[response] = tagInfo.n_responses[response] + 1 || 1;
    saveTagInfo(tagInfo);
  } catch (error) {
    if (error.code === 'ENOENT') {
      saveNewTagInfo(tag);
      const tagInfo = loadTagInfo(tag.name);
      tagInfo.n_responses[response] = 1;
      saveTagInfo(tagInfo);
    } else {
      throw error;
    }
  } finally {
    accLock.release();
  }
};

const saveNewTagInfo = (tag) => {
  const tagInfo = new TagInfo();
  tagInfo.parseTag(tag);
  try {
    saveTagInfo(tagInfo);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Tag name contains too many non-ascii characters!');
    } else {
      throw error;
    }
  }
};

const loadOverall = () => {
  try {
    const data = fs.readFileSync(OVERALL);
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const overall = {};
      for (let i = 0; i < ALL_RESPONSES.length; i++) {
        const response = ALL_RESPONSES[i];
        overall[response] = 0;
      }
      saveOverall(overall);
      return overall;
    } else {
      throw error;
    }
  }
};

const saveOverall = (overall) => {
  fs.writeFileSync(OVERALL, JSON.stringify(overall));
};

const accOverall = (response) => {
  const overall = loadOverall();
  overall[response] = overall[response] + 1 || 1;
  saveOverall(overall);
  if (DEBUG) {
    console.log('overall', overall);
  }
};

const doExist = (x, name) => {
  return fs.existsSync(`${x}/${name}`);
};

const init = () => {
  const directories = [DOCS, TAGS, IMGS];
  for (let i = 0; i < directories.length; i++) {
    const directory = directories[i];
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }
  }
};

module.exports = {
  listAll,
  saveImg,
  saveDoc,
  loadDoc,
  legalizeTagName,
  loadTagInfo,
  saveTagInfo,
  accTagInfo,
  saveNewTagInfo,
  loadOverall,
  saveOverall,
  accOverall,
  doExist,
  init,
};
