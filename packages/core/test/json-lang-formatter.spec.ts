import * as chai from 'chai';
const expect = chai.expect;

const jsonTmLangJson = require('@monaco-imposture-tools/grammars/json/JSON.tmLanguage.ext.json');

import {Registry, CodeDocument, IGrammar, StackElement, IToken, IRawTheme} from '../src/main';

enum FormatAction{
  INCREASE_INDENT = 0x1,
  DECREASE_INDENT,
  INPUT_CONTENT,
  INPUT_SPACE,
  INPUT_ENTER,
  INPUT_INDENT,
  INPUT_TABLE,
}

interface JsonToken extends IToken{
  content: string,
  customized: {
    formatterAction: FormatAction[]
  }
}

const WHITE_SPACES = /\s+/g
const defaultFormatActions = [FormatAction.INPUT_CONTENT];
const defaultCustomized = {formatterAction: defaultFormatActions};

const theme1:IRawTheme = {
  name: "default",
  settings: [
    {
      scope: "",
      settings:{
        customized: {
          formatterAction: [FormatAction.INPUT_CONTENT]
        }
      }
    },
    // root array and definition
    {
      scope: [
        'punctuation.definition.array.begin.json',
        'punctuation.definition.dictionary.begin.json'
      ],
      settings:{
        customized: {
          formatterAction: [FormatAction.INPUT_CONTENT, FormatAction.INCREASE_INDENT, FormatAction.INPUT_ENTER ]
        }
      }
    },
    {
      scope: [
        'punctuation.definition.array.end.json',
        'punctuation.definition.dictionary.end.json'
      ],
      settings:{
        customized: {
          formatterAction: [FormatAction.DECREASE_INDENT, FormatAction.INPUT_ENTER, FormatAction.INPUT_CONTENT]
        }
      },

    },
    // chained array and definition
    {
      scope: [
        'meta.structure.array.json meta.structure.array.json punctuation.definition.array.begin.json',
      ],
      settings:{
        customized: {
          formatterAction: [FormatAction.INPUT_CONTENT, FormatAction.INPUT_SPACE ]
        }
      }
    },
    {
      scope: [
        'meta.structure.array.json meta.structure.array.json punctuation.definition.array.end.json',
      ],
      settings:{
        customized: {
          formatterAction: [FormatAction.INPUT_SPACE, FormatAction.INPUT_CONTENT]
        }
      },
    },
    {
      scope: [
        'punctuation.separator.array.json',
        'punctuation.separator.dictionary.key-value.json',
      ],
      settings:{
        customized: {
          formatterAction: [FormatAction.INPUT_CONTENT, FormatAction.INPUT_SPACE]
        }
      }
    },
    {
      scope: [
        'punctuation.separator.dictionary.pair.json',
      ],
      settings:{
        customized: {
          formatterAction: [FormatAction.INPUT_CONTENT, FormatAction.INPUT_ENTER]
        }
      }
    }
  ]
}
// const theme2:IRawTheme = {
//   name: "default",
//   settings: [
//     {
//       scope: "",
//       settings:{
//         customized: {
//           formatterAction: [FormatAction.INPUT_CONTENT]
//         }
//       }
//     },
//     // root array and definition
//     {
//       scope: [
//         'punctuation.definition.array.begin.json',
//         'punctuation.definition.dictionary.begin.json'
//       ],
//       settings:{
//         customized: {
//           formatterAction: [FormatAction.INPUT_CONTENT, FormatAction.INCREASE_INDENT, FormatAction.INPUT_ENTER ]
//         }
//       }
//     },
//     {
//       scope: [
//         'punctuation.definition.array.end.json',
//         'punctuation.definition.dictionary.end.json'
//       ],
//       settings:{
//         customized: {
//           formatterAction: [FormatAction.DECREASE_INDENT, FormatAction.INPUT_ENTER, FormatAction.INPUT_CONTENT]
//         }
//       },
//
//     },
//     {
//       scope: [
//         'punctuation.separator.dictionary.key-value.json',
//       ],
//       settings:{
//         customized: {
//           formatterAction: [FormatAction.INPUT_CONTENT, FormatAction.INPUT_SPACE]
//         }
//       }
//     },
//     {
//       scope: [
//         'punctuation.separator.array.json',
//         'punctuation.separator.dictionary.pair.json',
//       ],
//       settings:{
//         customized: {
//           formatterAction: [FormatAction.INPUT_CONTENT, FormatAction.INPUT_ENTER]
//         }
//       }
//     }
//   ]
// }

describe('json formatter test', ()=>{
  const sampleStrV1 = `{
"value1": "one",
"value2": 
[1,2, [3,[4, 5],6], 7, [8,9]],
"value3": true,
"value4": { "value4.1": null },
}`;

  const sampleDocV1 = new CodeDocument(sampleStrV1);
  let langReg: Registry;
  let jsonGrammar: IGrammar;

  before(async ()=>{
    langReg = new Registry({
      getGrammarDefinition(scopeName, dependentScope) {
        return {
          format: 'json',
          content: jsonTmLangJson,
        };
      },
      theme: theme1
    });
    jsonGrammar = (await langReg.loadGrammar('source.json'))!;
  })

  it('formatter test 01', async ()=>{

    const text = sampleDocV1.text;
    let previousState: StackElement | undefined;
    let tokens: JsonToken[] = [];

    let i = 0;
    for (const splitLine of sampleDocV1.lines){
      const curTokenResult =  jsonGrammar.tokenizeLine(splitLine.text, previousState);
      const curOffset = sampleDocV1.accLineLen(i++);
      previousState = curTokenResult.ruleStack;
      curTokenResult.tokens.forEach(oneToken => {
        const startIndex = curOffset + oneToken.startIndex;
        const endIndex = curOffset + oneToken.endIndex;
        const content = text.substring(startIndex, endIndex);
        tokens.push({
          startIndex,
          endIndex,
          scopes: oneToken.scopes,
          meta: oneToken.meta,
          content,
          customized: oneToken.customized as JsonToken["customized"] ?? defaultCustomized
        });
      });
    }

    // filter out white spaces
    tokens = tokens.filter(token => !token.content || !token.content.match(WHITE_SPACES));

    let formattedStr = "";
    let currentIndents:string[] = [];
    const separator = "\n";
    const oneIndent = "\t";

    for(const oneJsonToken of tokens){
      // todo check input_content exist or not and handle it if not
      for (const oneAction of oneJsonToken.customized.formatterAction){
        switch (oneAction) {
          case FormatAction.INCREASE_INDENT:
            currentIndents.push(oneIndent);
            break;
          case FormatAction.DECREASE_INDENT:
            if (currentIndents.length){
              currentIndents.pop();
            }
            break;
          case FormatAction.INPUT_CONTENT:
            formattedStr += oneJsonToken.content;
            break;
          case FormatAction.INPUT_SPACE:
            formattedStr += " ";
            break;
          case FormatAction.INPUT_ENTER:
            formattedStr += separator;
            formattedStr += currentIndents.join('');
            break;
          case FormatAction.INPUT_INDENT:
            formattedStr += oneIndent;
            break;
          case FormatAction.INPUT_TABLE:
            formattedStr += '\t';
            break;
          default:
            // noop
            break;
        }
      }
    }

    const expectedStr = `{
\t"value1": "one",
\t"value2": [
\t\t1, 2, [ 3, [ 4, 5 ], 6 ], 7, [ 8, 9 ]
\t],
\t"value3": true,
\t"value4": {
\t\t"value4.1": null
\t},
\t
}`;
    expect(formattedStr).eq(expectedStr);
    expect(tokens.length).gt(0);
    expect(formattedStr.length).gt(0);

  })
})