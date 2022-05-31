import * as assert from 'assert';
import {initOnigasm} from '@monaco-imposture-tools/oniguruma-asm';
const origConsoleLog = console.log;

// ..\node_modules\@monaco-tm\oniguruma-asm\lib

initOnigasm().then(
  () => {
    assert.strictEqual(console.log, origConsoleLog);
  },
  (e) => {
    console.error(e);
  }
);
