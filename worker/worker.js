// worker.js
const { promisify } = require('util');
const { setTimeout } = require('timers/promises');
const { recordResponse } = require('../ai');

module.exports = async function worker({ action, response, doc, imageWorkerResult }) {
  if (action === 'next') {
    // Simulate some async activity
    await setTimeout(100);

    // Perform necessary operations to get the next job
    const nextDoc = getNextJob();

    // Simulate image worker result
    const imageWorker = { result: null };

    // Return the necessary data for the next job
    return {
      doc: nextDoc,
      imageWorker,
      mode: nextDoc.mode
    };
  } else if (action === 'recordResponse') {
    // Simulate some async activity
    await setTimeout(100);

    // Perform necessary operations to record the response
    recordResponse(response, doc, imageWorkerResult);

    // Return a success message
    return 'Response recorded successfully.';
  } else {
    throw new Error(`Unsupported action: ${action}`);
  }
};
