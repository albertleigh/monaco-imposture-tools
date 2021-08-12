const chai = require("chai");
const expect = chai.expect;

const jsonTmLangJson = require("@monaco-imposture-tools/grammars/json/JSON.tmLanguage.ext.json");

const {Registry} = require("..");

describe('json lang test', ()=>{
  it("json lang 100", async ()=>{
    const langReg = new Registry({getGrammarDefinition(scopeName, dependentScope) {
        return {
          format: 'json',
          content: jsonTmLangJson
        }
      }});
    const jsonGrammar = await langReg.loadGrammar("source.json");

    const sampleStr1 = '{"value1": "one"}';
    // const sampleStr2 = '{"value1": "one", "value2":2, "value3":true}';

    const tokens = jsonGrammar.tokenizeLine(sampleStr1);
    expect(tokens.tokens.length).ok;
  })
  it("json lang 200", async ()=>{
    const langReg = new Registry({getGrammarDefinition(scopeName, dependentScope) {
        return {
          format: 'json',
          content: jsonTmLangJson
        }
      }});
    const jsonGrammar = await langReg.loadGrammar("source.json");

    const sampleStr1 =
`{
\t"value1": "one",
\t"value2": 
\t\t2,
\t"value3": true,
\t"value4": {
\t\t"value4.1": null
\t},
}`;
    // const sampleStr2 = '{"value1": "one", "value2":2, "value3":true}';

    const codeDocument = jsonGrammar.parse(sampleStr1);

    const astStr = codeDocument.printASTNode();

    expect(astStr).ok;
    expect(codeDocument.root).ok;
  })
})
//{"value1":"one"}
