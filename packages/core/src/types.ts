// -- raw grammar typings
import {CodeDocument} from './grammar';

export interface ImpostureLang {
  /**
   * @deprecated
   */
  readonly filename?: string;
  // readonly rootScopeName?: string;
  readonly line?: number;
  readonly char?: number;
  [key: string]: any;
}

export interface ImpostureLangMeta {
  range?: Range;
}

export interface ILocatable {
  // todo rename $vscodeTextmateLocation into $impostureLang
  $impostureLang?: ImpostureLang;
  $impostureLangMeta?: ImpostureLangMeta;
}

export interface IGrammarDefinition {
  format: 'json' | 'plist';
  content: string | object;
}

export interface IRawGrammar extends ILocatable {
  repository: IRawRepository;
  readonly scopeName: string;
  readonly patterns: IRawRule[];
  readonly injections?: {[expression: string]: IRawRule};
  readonly injectionSelector?: string;

  readonly fileTypes?: string[];
  readonly name?: string;
  readonly firstLineMatch?: string;
}

export interface IRawRepositoryMap {
  [name: string]: IRawRule;
  $self: IRawRule;
  $base: IRawRule;
}

export type IRawRepository = IRawRepositoryMap & ILocatable;

export interface IRawRule extends ILocatable {
  id?: number;

  readonly include?: string;

  readonly name?: string;
  readonly contentName?: string;

  readonly match?: string;
  readonly captures?: IRawCaptures;
  readonly begin?: string;
  readonly beginCaptures?: IRawCaptures;
  readonly end?: string;
  readonly endCaptures?: IRawCaptures;
  readonly while?: string;
  readonly whileCaptures?: IRawCaptures;
  readonly patterns?: IRawRule[];

  readonly repository?: IRawRepository;

  readonly applyEndPatternLast?: boolean;
}

export interface IRawCapturesMap {
  [captureId: string]: IRawRule;
}

export type IRawCaptures = IRawCapturesMap & ILocatable;

// -- raw theme

/**
 * A single theme setting.
 */
export interface IRawThemeSetting {
  readonly name?: string;
  readonly scope?: string | string[];
  readonly settings: {
    readonly fontStyle?: string;
    readonly foreground?: string;
    readonly background?: string;
  };
}

/**
 * A TextMate theme.
 */
export interface IRawTheme {
  readonly name?: string;
  readonly settings: IRawThemeSetting[];
}

// -- registry

/**
 * A registry helper that can locate grammar file paths given scope names.
 */
export interface RegistryOptions {
  captureMeta?:boolean;
  debug?:boolean;
  theme?: IRawTheme;
  getGrammarDefinition(scopeName: string, dependentScope: string): Promise<IGrammarDefinition>;
  getInjections?(scopeName: string): string[];
}

// -- grammar

/**
 * A map from scope name to a language id. Please do not use language id 0.
 */
export interface IEmbeddedLanguagesMap {
  [scopeName: string]: number;
}

/**
 * A map from selectors to token types.
 */
export interface ITokenTypeMap {
  [selector: string]: StandardTokenType;
}

export const enum StandardTokenType {
  Other = 0,
  Comment = 1,
  String = 2,
  RegEx = 4,
}

export interface IGrammarConfiguration {
  embeddedLanguages?: IEmbeddedLanguagesMap;
  tokenTypes?: ITokenTypeMap;
}

/**
 * A grammar
 */
export interface IGrammar {
  /**
   * Tokenize `lineText` using previous line state `prevState`.
   */
  tokenizeLine(lineText: string, prevState: StackElement): ITokenizeLineResult;

  /**
   * Tokenize `lineText` using previous line state `prevState`.
   * The result contains the tokens in binary format, resolved with the following information:
   *  - language
   *  - token type (regex, string, comment, other)
   *  - font style
   *  - foreground color
   *  - background color
   * e.g. for getting the languageId: `(metadata & MetadataConsts.LANGUAGEID_MASK) >>> MetadataConsts.LANGUAGEID_OFFSET`
   */
  tokenizeLine2(lineText: string, prevState: StackElement): ITokenizeLineResult2;

  /**
   * Parse multiline `text` and generate a codeDocument w/ a syntax tree
   * @param text
   * @param option
   */
  parse(text: string, option?: {separator?: string}): CodeDocument;
}

export interface ITokenizeLineResult {
  readonly tokens: IToken[];
  /**
   * The `prevState` to be passed on to the next line tokenization.
   */
  readonly ruleStack: StackElement;
}

/**
 * Helpers to manage the "collapsed" metadata of an entire StackElement stack.
 * The following assumptions have been made:
 *  - languageId < 256 => needs 8 bits
 *  - unique color count < 512 => needs 9 bits
 *
 * The binary format is:
 * - -------------------------------------------
 *     3322 2222 2222 1111 1111 1100 0000 0000
 *     1098 7654 3210 9876 5432 1098 7654 3210
 * - -------------------------------------------
 *     xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx
 *     bbbb bbbb bfff ffff ffFF FTTT LLLL LLLL
 * - -------------------------------------------
 *  - L = LanguageId (8 bits)
 *  - T = StandardTokenType (3 bits)
 *  - F = FontStyle (3 bits)
 *  - f = foreground color (9 bits)
 *  - b = background color (9 bits)
 */
export const enum MetadataConsts {
  LANGUAGEID_MASK = 0b00000000000000000000000011111111,
  TOKEN_TYPE_MASK = 0b00000000000000000000011100000000,
  FONT_STYLE_MASK = 0b00000000000000000011100000000000,
  FOREGROUND_MASK = 0b00000000011111111100000000000000,
  BACKGROUND_MASK = 0b11111111100000000000000000000000,

  LANGUAGEID_OFFSET = 0,
  TOKEN_TYPE_OFFSET = 8,
  FONT_STYLE_OFFSET = 11,
  FOREGROUND_OFFSET = 14,
  BACKGROUND_OFFSET = 23,
}

export interface ITokenizeLineResult2 {
  /**
   * The tokens in binary format. Each token occupies two array indices. For token i:
   *  - at offset 2*i => startIndex
   *  - at offset 2*i + 1 => metadata
   *
   */
  readonly tokens: Uint32Array;
  /**
   * The `prevState` to be passed on to the next line tokenization.
   */
  readonly ruleStack: StackElement;
}

export interface IToken {
  startIndex: number;
  readonly endIndex: number;
  readonly scopes: string[];
}

/**
 * **IMPORTANT** - Immutable!
 */
export interface StackElement {
  _stackElementBrand: void;
  readonly depth: number;

  clone(): StackElement;
  equals(other: StackElement): boolean;
}


// todo rename into GenASTNode
/**
 * **IMPORTANT** - Readonly!
 */
export type ASTNode =
  | CaptureRuleASTNode
  | MatchRuleASTNode
  | IncludeOnlyRuleASTNode
  | BeginWhileRuleASTNode
  | BeginEndRuleASTNode;

export interface BaseASTNode extends ILocatable {
  readonly type: 'CaptureRule' | 'MatchRule' | 'IncludeOnlyRule' | 'BeginWhileRule' | 'BeginEndRule';
  parent?: ASTNode;
  scopeName: string;
  offset: number;
  length?: number;
  children?: ASTNode[];
}

export interface CaptureRuleASTNode extends BaseASTNode {
  readonly type: 'CaptureRule';
}
export interface MatchRuleASTNode extends BaseASTNode {
  readonly type: 'MatchRule';
}
export interface IncludeOnlyRuleASTNode extends BaseASTNode {
  readonly type: 'IncludeOnlyRule';
}
export interface BeginWhileRuleASTNode extends BaseASTNode {
  readonly type: 'BeginWhileRule';
  readonly subType: 'begin' | 'while';
  beginCaptureChildren?: ASTNode[];
  whileCaptureChildren?: ASTNode[];
}
export interface BeginEndRuleASTNode extends BaseASTNode {
  readonly type: 'BeginEndRule';
  beginCaptureChildren?: ASTNode[];
  endCaptureChildren?: ASTNode[];
}

export class Position {
  constructor(
    /**
     * Line position in a document (zero-based).
     * If a line number is greater than the number of lines in a document, it defaults back to the number of lines in the document.
     * If a line number is negative, it defaults to 0.
     */
    public line: number,
    /**
     * Character offset on a line in a document (zero-based). Assuming that the line is
     * represented as a string, the `character` value represents the gap between the
     * `character` and `character + 1`.
     *
     * If the character value is greater than the line length it defaults back to the
     * line length.
     * If a line number is negative, it defaults to 0.
     */
    public character: number
  ) {}

  static create(line: number, character: number): Position {
    return new Position(line, character);
  }

  static is(value: any): value is Position {
    return value instanceof Position && typeof value.line === 'number' && typeof value.character === 'number';
  }
}

export class Range {
  constructor(
    /**
     * The range's start position
     */
    public start: Position,
    /**
     * The range's end position.
     */
    public end: Position
  ) {}

  static create(startLine: number, startCharacter: number, endLine: number, endCharacter: number): Range;
  static create(start: Position, end: Position): Range;
  static create(): Range {
    const args = [...arguments];
    if (args.length === 2 && Position.is(args[0]) && Position.is(args[1])) {
      return new Range(args[0], args[1]);
    } else if (args.length === 4 && args.every((one) => typeof one === 'number')) {
      return new Range(new Position(args[0], args[1]), new Position(args[2], args[3]));
    }
    throw new Error('Invalid parameters for Range::create');
  }

  static is(value: any): value is Range {
    return value instanceof Range && Position.is(value.start) && Position.is(value.end);
  }
}