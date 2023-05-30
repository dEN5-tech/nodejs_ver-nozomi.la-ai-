const { roll, setBlackList } = require("./ai");
const { startServer } = require("./server");
const database = require("./database");
const fs = require("fs");

const main = () => {
  const abspath = __filename;
  const dname = require("path").dirname(abspath);
  process.chdir(dname);
  database.init();
  parseBlacklist();
  const server = startServer();
  try {
    roll();
  } catch (error) {
    throw error;
  }
};

const parseBlacklist = () => {
  const blacklist = [];
  try {
    const data = fs.readFileSync("blacklist.txt", "utf-8");
    const lines = data.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        try {
          database.loadTagInfo(trimmedLine);
        } catch (error) {
          throw new Error(
            `"${trimmedLine}" is not a valid tag name, or it is not cached yet.`
          );
        }
        blacklist.push(trimmedLine);
      }
    }
  } catch (error) {
    fs.writeFileSync("blacklist.txt", "\n");
  }
  setBlackList(blacklist);
};

main();
