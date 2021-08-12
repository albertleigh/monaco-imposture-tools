const fs = require('fs');
const path = require('path');

const wasmBinPath = path.resolve(__dirname, "..", "node_modules", "@monaco-imposture-tools", "oniguruma-asm", "lib", "OnigurumaAsm.wasm");
const grammarPath = path.resolve(__dirname, "..", "node_modules", "@monaco-imposture-tools", "grammars", "azure", "LogicApps.tmLanguage.json");
const extGrammarPath = path.resolve(__dirname, "..", "node_modules", "@monaco-imposture-tools", "grammars", "azure", "LogicApps.tmLanguage.ext.json");

const targetGrammarPath = path.resolve(__dirname, "..", 'grammar');
const targetScannerPath = path.resolve(__dirname, "..", 'scanner');

fs.mkdirSync(targetGrammarPath);
fs.mkdirSync(targetScannerPath);

fs.copyFileSync(wasmBinPath, path.join(targetScannerPath, "scanner.wasm"));
fs.copyFileSync(grammarPath, path.join(targetGrammarPath, "LogicApps.tmLanguage.json"));
fs.copyFileSync(extGrammarPath, path.join(targetGrammarPath, "LogicApps.tmLanguage.ext.json"));
