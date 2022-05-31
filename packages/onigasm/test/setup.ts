import * as assert from 'assert';
import {initOnigasm} from '../lib';
const origConsoleLog = console.log;

initOnigasm().then(
  () => {
    assert.strictEqual(console.log, origConsoleLog);
  },
  (e) => {
    console.error(e);
  }
);
