const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {loadWASM} = require('@monaco-imposture-tools/oniguruma-asm');
const origConsoleLog = console.log;

// ..\node_modules\@monaco-tm\oniguruma-asm\lib

const wasmBin = fs.readFileSync(
  path.resolve(__dirname, '..', 'node_modules', '@monaco-imposture-tools', 'oniguruma-asm', 'lib', 'OnigurumaAsm.wasm')
).buffer;

loadWASM(wasmBin).then(
  () => {
    assert.strictEqual(console.log, origConsoleLog);
  },
  (e) => {
    console.error(e);
  }
);
