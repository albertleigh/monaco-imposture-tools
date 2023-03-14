import {IRawTheme} from '@monaco-imposture-tools/core';
import type {editor} from "monaco-editor";
type BuiltinTheme = editor.BuiltinTheme;

/**
 * Convert a nullable themeName to a built-in theme name
 * @param themeName
 */
export function covert2BuiltInBaseTheme(themeName?: string): BuiltinTheme {
  let result: BuiltinTheme = 'vs';
  if (!themeName) {
    return result;
  } else if (themeName.indexOf('hc-black') > -1) {
    result = 'hc-black';
  } else if (themeName.indexOf('vs-dark') > -1) {
    result = 'vs-dark';
  }
  return result;
}

/**
    convert a Number to a two character hex string
    must round, or we will end up with more digits than expected (2)
    note: can also result in single digit, which will need to be padded with a 0 to the left
    @param: num         => the number to convert to hex
    @returns: string    => the hex representation of the provided number
*/
function int_to_hex(num: number) {
  let hex = Math.round(num).toString(16);
  if (hex.length == 1)
    hex = '0' + hex;
  return hex;
}

/**
    blend two colors to create the color that is at the percentage away from the first color
    this is a 5 step process
        1: validate input
        2: convert input to 6 char hex
        3: convert hex to rgb
        4: take the percentage to create a ratio between the two colors
        5: convert blend to hex
    @param: color1      => the first color, hex (ie: #000000)
    @param: color2      => the second color, hex (ie: #ffffff)
    @param: percentage  => the distance from the first color, as a decimal between 0 and 1 (ie: 0.5)
    @returns: string    => the third color, hex, represenatation of the blend between color1 and color2 at the given percentage
*/
function blend_colors(color1: string, color2: string, percentage: number, debugMode = false): string {
  // check input
  color1 = color1 || '#000000';
  color2 = color2 || '#ffffff';
  percentage = percentage || 0.5;

  // 1: validate input, make sure we have provided a valid hex
  if (color1.length != 4 && color1.length != 7)
    throw new Error('colors must be provided as hexes');

  if (color2.length != 4 && color2.length != 7)
    throw new Error('colors must be provided as hexes');

  if (percentage > 1 || percentage < 0)
    throw new Error('percentage must be between 0 and 1');

  // 2: check to see if we need to convert 3 char hex to 6 char hex, else slice off hash
  //      the three character hex is just a representation of the 6 hex where each character is repeated
  //      ie: #060 => #006600 (green)
  if (color1.length == 4)
    color1 = color1[1] + color1[1] + color1[2] + color1[2] + color1[3] + color1[3];
  else
    color1 = color1.substring(1);
  if (color2.length == 4)
    color2 = color2[1] + color2[1] + color2[2] + color2[2] + color2[3] + color2[3];
  else
    color2 = color2.substring(1);

  debugMode && console.log('valid: c1 => ' + color1 + ', c2 => ' + color2);

  // 3: we have valid input, convert colors to rgb
  const color1Arr = [parseInt(color1[0] + color1[1], 16), parseInt(color1[2] + color1[3], 16), parseInt(color1[4] + color1[5], 16)];
  const color2Arr = [parseInt(color2[0] + color2[1], 16), parseInt(color2[2] + color2[3], 16), parseInt(color2[4] + color2[5], 16)];

  debugMode && console.log('hex -> rgba: c1 => [' + color1Arr.join(', ') + '], c2 => [' + color2Arr.join(', ') + ']');

  // 4: blend
  const color3Arr = [
    (1 - percentage) * color1Arr[0] + percentage * color2Arr[0],
    (1 - percentage) * color1Arr[1] + percentage * color2Arr[1],
    (1 - percentage) * color1Arr[2] + percentage * color2Arr[2]
  ];

  debugMode && console.log('c3 => [' + color3Arr.join(', ') + ']');

  // 5: convert to hex
  const resultColor = '#' + int_to_hex(color3Arr[0]) + int_to_hex(color3Arr[1]) + int_to_hex(color3Arr[2]);

  debugMode && console.log(color3Arr);


  // return hex
  return resultColor;
}

export function createAzLgcTheme(
  name: string,
  opt: {
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
    incompleteAtSymbolFg?: string,
    incompleteFunctionNameFg?: string,
    incompleteVariableFg?: string,
  }
): IRawTheme {

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

  const incompleteAtSymbolFg = opt.incompleteAtSymbolFg || blend_colors(opt.atSymbolFg, opt.stringFg, 0.4);
  const incompleteFunctionNameFg = opt.incompleteFunctionNameFg || blend_colors(opt.functionNameFg, opt.stringFg, 0.4);
  const incompleteVariableFg = opt.incompleteVariableFg || blend_colors(opt.variableFg, opt.stringFg, 0.4);

  return {
    name,
    settings: [
      {
        scope: [
          'source.azLgcAppExp'
        ],
        settings: {
          foreground: expressionFg         //--vscode-debugTokenExpression-string
        }
      },
      {
        scope: [
          'constant.character.escape.azLgcAppExp'
        ],
        settings: {
          foreground: escapedAtSymbolFg
        }
      },
      {
        scope: [
          'keyword.symbol.at'
        ],
        settings: {
          foreground: atSymbolFg
        }
      },
      {
        scope: [
          'meta.expression.function.call.incomplete keyword.symbol.at',
        ],
        settings: {
          foreground: incompleteAtSymbolFg
        }
      },
      {
        scope: [
          'meta.template.expression.azLgcAppExp',
          'punctuation.definition.template.expression',
          'meta.template.expression.azLgcAppExp keyword.symbol.at'
        ],
        settings: {
          foreground: atTemplateFg
        }
      },
      {
        scope: [
          'meta.delimiter',
          'meta.brace',
          'punctuation',
        ],
        settings: {
          foreground: punctuationFg         // --vscode-editorSuggestWidget-background
        }
      },
      {
        scope: [
          'string.quoted',
          'punctuation.definition.string',
        ],
        settings: {
          foreground: stringFg         // --vscode-editorMarkerNavigationError-background
        }
      },
      // there were no q-string beneath incomplete function call
      // thus we need not put expressionFg colors upon beneath an incomplete function call
      // {
      //   scope: [
      //     'meta.expression.function.call.incomplete string.quoted',
      //     'meta.expression.function.call.incomplete punctuation.definition.string',
      //   ],
      //   settings:{
      //     foreground: expressionFg         // --vscode-editorMarkerNavigationError-background
      //   }
      // },
      {
        scope: [
          'variable'
        ],
        settings: {
          foreground: variableFg
        }
      },
      {
        scope: [
          'meta.expression.function.call.incomplete variable',
        ],
        settings: {
          foreground: incompleteVariableFg
        }
      },
      {
        scope: 'variable.other.constant',
        settings: {
          fontStyle: 'bold'
        }
      },
      {
        scope: 'constant.numeric',
        settings: {
          foreground: numericFg
        }
      },
      {
        scope: [
          'meta.function-call',
          'storage.type.numeric',
        ],
        settings: {
          foreground: functionFg         // --vscode-editorSuggestWidget-foreground
        }
      },
      {
        scope: [
          'constant.language.boolean',
          'constant.language.null',
        ],
        settings: {
          foreground: constantFg
        }
      },
      {
        scope: [
          'entity.name.function',
        ],
        settings: {
          foreground: functionNameFg,
          fontStyle: 'bold'
        }
      },
      {
        scope: [
          'meta.expression.function.call.incomplete entity.name.function',
        ],
        settings: {
          foreground: incompleteFunctionNameFg,
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
