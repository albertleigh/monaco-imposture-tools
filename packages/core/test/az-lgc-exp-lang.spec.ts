import * as chai from 'chai';
const expect = chai.expect;

const lgcTmLangJson = require('@monaco-imposture-tools/grammars/azure/LogicApps.tmLanguage.ext.json');

import {Registry} from '../src/main';

describe('azLgcExp lang test', ()=>{
  it ('azLgcExp lang 100', async ()=>{
    const langReg = new Registry({
      getGrammarDefinition(scopeName, dependentScope) {
        return {
          format: 'json',
          content: lgcTmLangJson,
        };
      },
    });
    const azLgcGrammar = (await langReg.loadGrammar('source.azLgcAppExp', 0))!;
    const sampleStr1 = '@pipeline().DataFactory';
    const codeDocument = azLgcGrammar.parse(sampleStr1);

    const astStr = codeDocument.printASTNode();

    expect(astStr).ok;
    expect(codeDocument.root).ok;
  })

  // todo move to lang packages
  it ('azLgcExp lang 101', async ()=>{
    const langReg = new Registry({
      getGrammarDefinition(scopeName, dependentScope) {
        return {
          format: 'json',
          content: lgcTmLangJson,
        };
      },
    });
    const azLgcGrammar = (await langReg.loadGrammar('source.azLgcAppExp', 0))!;
    const sampleStr1 = '@';
    const codeDocument = azLgcGrammar.parse(sampleStr1);

    expect(codeDocument.root?.children[0].offset).eq(0);
    expect(codeDocument.root?.children[0].length).eq(1);

    const astStr = codeDocument.printASTNode();

    expect(astStr).ok;
    expect(codeDocument.root).ok;
  })

})