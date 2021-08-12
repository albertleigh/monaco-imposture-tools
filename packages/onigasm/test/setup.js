const fs = require('fs')
const path = require('path')
const assert = require('assert')
const {
  loadWASM
} = require('../lib');
const origConsoleLog = console.log;

const wasmBin = fs.readFileSync(path.join(__dirname, '../lib/OnigurumaAsm.wasm')).buffer

loadWASM(wasmBin).then(()=>{
  assert.strictEqual(console.log, origConsoleLog)
}, (e)=>{
  console.error(e);
})
