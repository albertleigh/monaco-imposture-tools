const fs = require('fs');
const path = require('path');

const grammarPath = path.resolve(__dirname, "..", "node_modules", "@monaco-imposture-tools", "grammars", "azure", "LogicApps.tmLanguage.json");
const extGrammarPath = path.resolve(__dirname, "..", "node_modules", "@monaco-imposture-tools", "grammars", "azure", "LogicApps.tmLanguage.ext.json");

const targetGrammarPath = path.resolve(__dirname, "..", 'grammar');

fs.mkdirSync(targetGrammarPath);

fs.copyFileSync(grammarPath, path.join(targetGrammarPath, "LogicApps.tmLanguage.json"));
fs.copyFileSync(extGrammarPath, path.join(targetGrammarPath, "LogicApps.tmLanguage.ext.json"));
