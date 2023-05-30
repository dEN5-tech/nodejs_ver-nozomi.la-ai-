const { Semaphore } = require('semaphore-async-await');

async function forceMap(functions, iterInput, threadMax = 4) {
  let threadNum = 0;
  let resultNum = 0;
  const listOutput = new Array(iterInput.length);
  const queue = [];
  const lock = new Semaphore(1);

  const processInput = async (id, input) => {
    const output = await functions(input);
    await lock.acquire();
    listOutput[id] = output;
    resultNum += 1;
    lock.release();
    processQueue();
  };

  const processQueue = async () => {
    while (resultNum < listOutput.length && threadNum < threadMax) {
      const { id, input } = queue.shift();
      threadNum += 1;
      processInput(id, input);
    }
  };

  for (let i = 0; i < iterInput.length; i++) {
    const input = iterInput[i];
    await lock.acquire();
    queue.push({ id: i, input });
    lock.release();
    await processQueue();
  }

  await lock.acquire();
  while (resultNum < listOutput.length) {
    if (queue.length > 0) {
      const { id, input } = queue.shift();
      threadNum += 1;
      processInput(id, input);
    } else {
      break;
    }
  }
  lock.release();

  return listOutput;
}

async function task(name) {
  console.log(name, 'start');
  await sleep(0.5);
  console.log(name, 1);
  await sleep(0.5);
  console.log(name, 2);
  await sleep(0.5);
  console.log(name, 'END');
  return name;
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

module.exports = {
  forceMap,
  task,
};
