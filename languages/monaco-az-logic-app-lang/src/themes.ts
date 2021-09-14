import {IRawTheme} from '@monaco-imposture-tools/core';

export function createAzLgcTheme(
  name: string,
  opt:{
    expressionFg: string,
    atSymbolFg: string,
    atTemplateFg: string,
    escapedAtSymbolFg: string,
    punctuationFg: string,
    stringFg: string,
    variableFg: string,
    numericFg: string,
    functionFg: string,
    functionNameFg: string,
    constantFg: string,
  }
):IRawTheme{

  const {
    expressionFg,
    atSymbolFg,
    atTemplateFg,
    escapedAtSymbolFg,
    punctuationFg,
    stringFg,
    variableFg,
    numericFg,
    functionFg,
    functionNameFg,
    constantFg,
  } = opt

  return {
    name,
    settings: [
      {
        scope: [
          'source.azLgcAppExp'
        ],
        settings:{
          foreground: expressionFg         //--vscode-debugTokenExpression-string
        }
      },
      {
        scope: [
          'constant.character.escape.azLgcAppExp'
        ],
        settings:{
          foreground: escapedAtSymbolFg
        }
      },
      {
        scope: 'keyword.symbol.at',
        settings:{
          foreground: atSymbolFg
        }
      },
      {
        scope: [
          'meta.template.expression.azLgcAppExp',
          'punctuation.definition.template.expression',
          'meta.template.expression.azLgcAppExp keyword.symbol.at'
        ],
        settings:{
          foreground: atTemplateFg
        }
      },
      {
        scope: [
          'meta.delimiter',
          'meta.brace',
          'punctuation',
        ],
        settings:{
          foreground: punctuationFg         // --vscode-editorSuggestWidget-background
        }
      },
      {
        scope: [
          'string.quoted',
          'punctuation.definition.string',
        ],
        settings:{
          foreground: stringFg         // --vscode-editorMarkerNavigationError-background
        }
      },
      {
        scope: [
          'variable'
        ],
        settings:{
          foreground: variableFg
        }
      },
      {
        scope: 'variable.other.constant',
        settings:{
          fontStyle: 'bold'
        }
      },
      {
        scope: 'constant.numeric',
        settings:{
          foreground: numericFg
        }
      },
      {
        scope: [
          'meta.function-call',
          'storage.type.numeric',
        ],
        settings:{
          foreground: functionFg         // --vscode-editorSuggestWidget-foreground
        }
      },
      {
        scope: [
          'constant.language.boolean',
          'constant.language.null',
        ],
        settings:{
          foreground: constantFg
        }
      },
      {
        scope: [
          'entity.name.function',
        ],
        settings:{
          foreground: functionNameFg,
          fontStyle: 'bold'
        }
      },
    ]
  }
}

export const vs = createAzLgcTheme(
  'vs',
  {
    expressionFg: '#A31515',
    escapedAtSymbolFg: '#811F3F',
    atSymbolFg: '#0000FF',
    atTemplateFg: '#560B0B',
    punctuationFg: '#252526',
    stringFg: '#F48771',
    variableFg: '#001080',
    numericFg: '#098658',
    functionFg: '#000000',
    constantFg: '#0000FF',
    functionNameFg: '#795E26',
  }
);

export const vsDark = createAzLgcTheme(
  'vs-dark',
  {
    expressionFg: '#CE9178',
    escapedAtSymbolFg: '#D16969',
    atSymbolFg: '#569CD6',
    atTemplateFg: '#C3602C',
    punctuationFg: '#D4D4D4',
    stringFg: '#d670d6',
    variableFg: '#2CA5FF',
    numericFg: '#B5CEA8',
    functionFg: '#cccccc',
    constantFg: '#4e94ce',
    functionNameFg: '#DCDCAA',
  }
);

export const hcBlack = createAzLgcTheme(
  'hc-black',
  {
    expressionFg: '#CE9151',
    escapedAtSymbolFg: '#D16969',
    atSymbolFg: '#569CD6',
    atTemplateFg: '#CE6A27',
    punctuationFg: '#EFFFEF',
    stringFg: '#d670d6',
    variableFg: '#9CDCFE',
    numericFg: '#B5CE82',
    functionFg: '#FFD79C',
    constantFg: '#568898',
    functionNameFg: '#DCDCAA',
  }
);

export const themes: Record<string, IRawTheme> = {
  default: vs,
  [vs.name!]: vs,
  [vsDark.name!]: vsDark,
  [hcBlack.name!]: hcBlack
}

export default themes;
