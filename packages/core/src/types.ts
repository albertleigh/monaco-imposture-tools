// -- raw grammar typings
import {CodeDocument} from './grammar';

export const DEFAULT_SEPARATORS = ['\r\n','\n'];

export interface ImpostureLang {
  /**
   * @deprecated
   */
  readonly filename?: string;
  // readonly rootScopeName?: string;
  readonly line?: number;
  readonly char?: number;
  // todo add a new field name?
  [key: string]: any;
}

export interface ImpostureLangMeta {
  range?: Range;
}

export interface ILocatable {
  // todo rename $impostureLang into _$lang
  $impostureLang?: ImpostureLang;
  // todo rename $impostureLangMeta into _$meta
  $impostureLangMeta?: ImpostureLangMeta;
}

export interface IGrammarDefinition {
  format: 'json';
  content: string | object;
}

export interface IRawGrammar extends ILocatable {
  // todo readonly?
  repository: IRawRepository;
  readonly scopeName: string;
  readonly patterns: IRawRule[];
  /**
   * Expression would be like
   *    R is of lower priority
   *    L is of higher priority, the lefter the position the better
   *    - means not
   *    , and | stands for conjunction
   *  e.g.
   *  seg1.seg2.seg3
   *  L:seg1.seg2.seg3
   *  R:(seg1.seg2.seg3,seg4.seg5.seg6)
   *  R:(seg1.seg2.seg3,seg4.seg5.seg6),(seg1.seg2.seg3,seg4.seg5.seg6)
   *  R:(seg1.seg2.seg3,-seg4.seg5.seg6),(seg1.seg2.seg3,seg4.seg5.seg6)

   */
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

  /**
   * include string could be
   *    referring self like:              $base or $self
   *    referring from repository like:   #otherRule
   *    referring other lang's repo like: other-lang#otherRule
   */
  readonly include?: string;

  // todo we could just use one of the name and contentName
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
  /**
   * hierarchic scope list seperated by comma like:
   *    eg:
   *      "scopeList1,scopeList2,scopeList3,scopeList4"
   *    or
   *      ["scopeList1", "scopeList2", "scopeList3", "scopeList4"]
   *
   * and one scopeList could also be consisted of multiple scopes seperated by space like:
   *    eg:
   *      "scope1 scope2 scope3 scope4"
   *    todo:
   *      consider "scope1> scope2 scope3 scope4"
   */
  readonly scope?: string | string[];
  readonly settings: {
    /**
     * font style of the current scope which could be string like: italic, bold, underline
     * eg:
     *        "italic"
     *        "italic bold"
     */
    readonly fontStyle?: string;
    /**
     * Hexadecimal color like #0e0e0e
     */
    readonly foreground?: string;
    /**
     * Hexadecimal color like #ffffff
     */
    readonly background?: string;
    /**
     * Additional customized style record
     */
    readonly customized?: Record<string, any>;
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
  getGrammarDefinition(scopeName: string, dependentScope?: string | null): Promise<IGrammarDefinition> | IGrammarDefinition;
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
  tokenizeLine(lineText: string, prevState: StackElement | undefined): ITokenizeLineResult;

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
  tokenizeLine2(lineText: string, prevState: StackElement | undefined): ITokenizeLineResult2;

  /**
   * Parse multiline `text` and generate a codeDocument w/ a syntax tree
   * @param text
   * @param option
   */
  parse(text: string, option?: {separators?: string[]}): CodeDocument;
}

export interface ITokenizeLineResult {
  readonly tokens: IToken[];
  /**
   * The `prevState` to be passed on to the next line tokenization.
   */
  readonly ruleStack: StackElement;
}

/**
 * The tokens on the line in a binary, encoded format. Each token occupies two array indices. For token i:
 *  - at offset 2*i => startIndex
 *  - at offset 2*i + 1 => metadata
 * Meta data is in binary format:
 * - -------------------------------------------
 *     3322 2222 2222 1111 1111 1100 0000 0000
 *     1098 7654 3210 9876 5432 1098 7654 3210
 * - -------------------------------------------
 *     bbbb bbbb ffff ffff fFFF FBTT LLLL LLLL
 * - -------------------------------------------
 *  - L = EncodedLanguageId (8 bits): Use `getEncodedLanguageId` to get the encoded ID of a language.
 *  - T = StandardTokenType (2 bits): Other = 0, Comment = 1, String = 2, RegEx = 3.
 *  - B = Balanced brackets (1 bits): ??? unDocumented
 *  - F = FontStyle (4 bits): None = 0, Italic = 1, Bold = 2, Underline = 4, Strikethrough = 8.
 *  - f = foreground ColorId (9 bits)
 *  - b = background ColorId (8 bits)
 *  - The color value for each colorId is defined in IStandaloneThemeData.customTokenColors:
 * e.g. colorId = 1 is stored in IStandaloneThemeData.customTokenColors[1]. Color id = 0 means no color,
 * id = 1 is for the default foreground color, id = 2 for the default background.
 */
export const enum MetadataConsts {
  LANGUAGEID_MASK         = 0b00000000000000000000000011111111,
  TOKEN_TYPE_MASK         = 0b00000000000000000000001100000000,
  BALANCED_BRACKETS_MASK  = 0b00000000000000000000010000000000,
  FONT_STYLE_MASK         = 0b00000000000000000111100000000000,
  FOREGROUND_MASK         = 0b00000000111111111000000000000000,
  BACKGROUND_MASK         = 0b11111111000000000000000000000000,

  LANGUAGEID_OFFSET         = 0,
  TOKEN_TYPE_OFFSET         = 8,
  BALANCED_BRACKETS_OFFSET  = 10,
  FONT_STYLE_OFFSET         = 11,
  FOREGROUND_OFFSET         = 15,
  BACKGROUND_OFFSET         = 24,
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
  readonly meta:number;
  readonly customized?: Record<string, any>
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

// todo consider moving those below into a syntax model or somewhere

/**
 * **IMPORTANT** - Readonly!
 */
export type ASTNode =
  | CaptureRuleASTNode
  | MatchRuleASTNode
  | IncludeOnlyRuleASTNode
  | BeginWhileRuleASTNode
  | BeginEndRuleASTNode;

export abstract class BaseASTNode implements ILocatable{
  public $impostureLang?: ImpostureLang;
  public $impostureLangMeta?: ImpostureLangMeta;
 protected constructor(
   public readonly type: 'CaptureRule' | 'MatchRule' | 'IncludeOnlyRule' | 'BeginWhileRule' | 'BeginEndRule',
   public scopeName: string,
   public offset: number,
   public length: number = 0,
   public parent?: ASTNode,
   public children: ASTNode[] = []
 ) {
 }

  findAnElderSibling<T extends BaseASTNode = ASTNode>():T|undefined{
    if (this.parent) {
      const theIndex = this.parent.children?.findIndex((value) => value === this);
      if (typeof theIndex === 'number' && theIndex > 0) {
        return this.parent.children![theIndex - 1] as T;
      }
    }
    return undefined;
  }

  findAYoungerSibling<T extends BaseASTNode = ASTNode>():T|undefined{
    if (this.parent) {
      const theIndex = this.parent.children?.findIndex((value) => value === this);
      if (typeof theIndex === 'number' && theIndex < this.parent.children!.length - 1) {
        return this.parent.children![theIndex + 1] as T;
      }
    }
    return undefined;
  }

}

export class CaptureRuleASTNode extends BaseASTNode {
  readonly type: 'CaptureRule';
  constructor(scopeName: string, offset: number, length?: number, parent?: ASTNode, children?: ASTNode[]) {
    super('CaptureRule', scopeName, offset, length, parent, children);
  }
}

export class MatchRuleASTNode extends BaseASTNode {
  readonly type: 'MatchRule';
  constructor(scopeName: string, offset: number, length?: number, parent?: ASTNode, children?: ASTNode[]) {
    super('MatchRule', scopeName, offset, length, parent, children);
  }
}

export class IncludeOnlyRuleASTNode extends BaseASTNode {
  readonly type: 'IncludeOnlyRule';
  constructor(scopeName: string, offset: number, length?: number, parent?: ASTNode, children?: ASTNode[]) {
    super('IncludeOnlyRule', scopeName, offset, length, parent, children);
  }
}

export class BeginWhileRuleASTNode extends BaseASTNode {
  readonly type: 'BeginWhileRule';
  constructor(
    readonly subType: 'begin' | 'while',
    scopeName: string, offset: number,
    length?: number, parent?: ASTNode,
    children?: ASTNode[],
    public beginCaptureChildren: ASTNode[] = [],
    public whileCaptureChildren: ASTNode[] = [],
  ) {
    super('BeginWhileRule', scopeName, offset, length, parent, children);
  }
}

export class BeginEndRuleASTNode extends BaseASTNode {
  readonly type: 'BeginEndRule';
  constructor(
    scopeName: string, offset: number,
    length?: number, parent?: ASTNode,
    children?: ASTNode[],
    public beginCaptureChildren: ASTNode[] = [],
    public endCaptureChildren: ASTNode[] = [],
  ) {
    super('BeginEndRule', scopeName, offset, length, parent, children);
  }
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
