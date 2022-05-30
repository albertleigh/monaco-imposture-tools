import {
  CodeDocumentOffsetNotInRange,
  CodeDocumentPositionNotInRange,
  FontStyle,
  ICompiledRule,
  IGrammarRepository,
  IRuleFactoryHelper,
  IRuleRegistry,
  IScopeNameSet,
  IThemeProvider,
  Matcher,
} from './common';
import {clone} from './utils';
import {
  DEFAULT_SEPARATORS,
  ASTNode,
  CaptureRuleASTNode,
  BeginEndRuleASTNode,
  BeginWhileRuleASTNode,
  IncludeOnlyRuleASTNode,
  MatchRuleASTNode,
  IRawGrammar,
  IRawRepository,
  IRawRule,
  Position,
  Range,
} from './types';
import {BeginEndRule, BeginWhileRule, CaptureRule, MatchRule, Rule, RuleFactory} from './rule';
import {IOnigCaptureIndex, OnigUTF8String} from '@monaco-imposture-tools/oniguruma-asm';
import {createMatchers} from './matcher';
import {
  IEmbeddedLanguagesMap,
  IGrammar,
  IToken,
  ITokenizeLineResult,
  ITokenizeLineResult2,
  ITokenTypeMap,
  MetadataConsts,
  StackElement as StackElementDef,
  StandardTokenType,
} from './main';
import debug from './debug';
import {ThemeTrieElementRule} from './theme';

// todo consider merge w/ StandardTokenType
export const enum TemporaryStandardTokenType {
  Other = 0,
  Comment = 1,
  String = 2,
  RegEx = 4,
  MetaEmbedded = 8,
}

function toTemporaryType(standardType: StandardTokenType): TemporaryStandardTokenType {
  switch (standardType) {
    case StandardTokenType.RegEx:
      return TemporaryStandardTokenType.RegEx;
    case StandardTokenType.String:
      return TemporaryStandardTokenType.String;
    case StandardTokenType.Comment:
      return TemporaryStandardTokenType.Comment;
    case StandardTokenType.Other:
    default:
      // `MetaEmbedded` is the same scope as `Other`
      // but it overwrites existing token types in the stack.
      return TemporaryStandardTokenType.MetaEmbedded;
  }
}

/**
 * Initialize raw grammar
 */
function initGrammar(grammar: IRawGrammar, base: IRawRule | null | undefined): IRawGrammar {
  grammar = clone(grammar);

  grammar.repository = grammar.repository || <any>{};
  // todo rename $impostureLang
  grammar.repository.$self = {
    $impostureLang: grammar.$impostureLang,
    patterns: grammar.patterns,
    name: grammar.scopeName,
  };
  grammar.repository.$base = base || grammar.repository.$self;
  return grammar;
}

/**
 * do create a grammar object
 * @param grammar
 * @param initialLanguage
 * @param embeddedLanguages
 * @param tokenTypes
 * @param grammarRepository
 */
export function createGrammar(
  grammar: IRawGrammar,
  initialLanguage: number,
  embeddedLanguages: IEmbeddedLanguagesMap | undefined,
  tokenTypes: ITokenTypeMap | undefined,
  grammarRepository: IGrammarRepository & IThemeProvider
): Grammar {
  return new Grammar(grammar, initialLanguage, embeddedLanguages, tokenTypes, grammarRepository);
}

/**
 * Fill in `result` all external lang name included scopes in `patterns`
 *  e.g.
 *    pick up `other-lang` from `other-lang#otherRule`
 */
function _extractIncludedScopesInPatterns(result: IScopeNameSet, patterns: IRawRule[] | undefined): void {
  if (patterns?.length){
    for (let i = 0, len = patterns.length; i < len; i++) {
      if (Array.isArray(patterns[i].patterns)) {
        _extractIncludedScopesInPatterns(result, patterns[i].patterns);
      }

      const include = patterns[i].include;

      if (!include) {
        continue;
      }

      if (include === '$base' || include === '$self') {
        // Special includes that can be resolved locally in this grammar
        continue;
      }

      if (include.charAt(0) === '#') {
        // Local include from this grammar
        continue;
      }

      const sharpIndex = include.indexOf('#');
      if (sharpIndex >= 0) {
        result[include.substring(0, sharpIndex)] = true;
      } else {
        result[include] = true;
      }
    }
  }
}

/**
 * Fill in `result` all external included scopes in `repository`
 */
function _extractIncludedScopesInRepository(result: IScopeNameSet, repository: IRawRepository): void {
  for (const name in repository) {
    const rule = repository[name];

    if (rule.patterns && Array.isArray(rule.patterns)) {
      _extractIncludedScopesInPatterns(result, rule.patterns);
    }

    if (rule.repository) {
      _extractIncludedScopesInRepository(result, rule.repository);
    }
  }
}

/**
 * Collects the list of all external included scopes in `grammar`.
 */
export function collectIncludedScopes(result: IScopeNameSet, grammar: IRawGrammar): void {
  if (grammar.patterns && Array.isArray(grammar.patterns)) {
    _extractIncludedScopesInPatterns(result, grammar.patterns);
  }

  if (grammar.repository) {
    _extractIncludedScopesInRepository(result, grammar.repository);
  }

  // remove references to own scope (avoid recursion)
  delete result[grammar.scopeName];
}

export interface Injection {
  readonly matcher: Matcher<string[]>;
  readonly priority: -1 | 0 | 1; // 0 is the default. -1 for 'L' and 1 for 'R'
  readonly ruleId: number;
  readonly grammar: IRawGrammar;
}

function scopesAreMatching(thisScopeName: string | undefined, scopeName: string): boolean {
  if (!thisScopeName) {
    return false;
  }
  if (thisScopeName === scopeName) {
    return true;
  }
  const len = scopeName.length;
  return thisScopeName.length > len && thisScopeName.substring(0, len) === scopeName && thisScopeName[len] === '.';
}

/**
 * A name matcher who find out whether identifiers could discretely match scopes or not.
 * Identifiers should be a subset of scopes in the sequence.
 *
 * @param identifiers
 * @param scopes
 */
function nameMatcher(identifiers: string[], scopes: string[]) {
  if (scopes.length < identifiers.length) {
    return false;
  }
  let lastIndex = 0;
  return identifiers.every((identifier) => {
    for (let i = lastIndex; i < scopes.length; i++) {
      if (scopesAreMatching(scopes[i], identifier)) {
        lastIndex = i + 1;
        return true;
      }
    }
    return false;
  });
}

function collectInjections(
  result: Injection[],
  selector: string,
  rule: IRawRule,
  ruleFactoryHelper: IRuleFactoryHelper,
  grammar: IRawGrammar
): void {
  const matchers = createMatchers(selector, nameMatcher);
  const ruleId = RuleFactory.getCompiledRuleId(rule, ruleFactoryHelper, grammar.repository);
  for (const matcher of matchers) {
    result.push({
      matcher: matcher.matcher,
      ruleId: ruleId,
      grammar: grammar,
      priority: matcher.priority,
    });
  }
}

/**
 * The metadata containing the scopeName, languageId, tokenType and matched theme rules of a scope name
 */
export class ScopeMetadata {
  constructor(
    public readonly scopeName: string,
    public readonly languageId: number,
    public readonly tokenType: TemporaryStandardTokenType,
    public readonly themeData: ThemeTrieElementRule[] | undefined
  ) {}
}

/**
 * A cache & helper layer for metaData for binary output
 */
class ScopeMetadataProvider {
  private _cache: Record<string, ScopeMetadata>;
  private _defaultMetaData: ScopeMetadata & {themeData: ThemeTrieElementRule[]};
  private readonly _embeddedLanguages: IEmbeddedLanguagesMap;
  private readonly _embeddedLanguagesRegex: RegExp | undefined;

  constructor(
    private readonly _initialLanguage: number,
    private readonly _themeProvider: IThemeProvider,
    embeddedLanguages: IEmbeddedLanguagesMap | undefined
  ) {
    this.onDidChangeTheme();

    // embeddedLanguages handling
    this._embeddedLanguages = Object.create(null);

    if (embeddedLanguages) {
      // If embeddedLanguages are configured, fill in `this._embeddedLanguages`
      const scopes = Object.keys(embeddedLanguages);
      for (let i = 0, len = scopes.length; i < len; i++) {
        const scope = scopes[i];
        const language = embeddedLanguages[scope];
        // never hurts to be too careful
        if (typeof language !== 'number' || language === 0) {
          // eslint-disable-next-line no-console
          console.warn('Invalid embedded language found at scope ' + scope + ': <<' + language + '>>');
          continue;
        }
        this._embeddedLanguages[scope] = language;
      }
    }

    // create the regex
    const escapedScopes = Object.keys(this._embeddedLanguages).map((scopeName) =>
      ScopeMetadataProvider._escapeRegExpCharacters(scopeName)
    );
    if (escapedScopes.length === 0) {
      // no scopes registered
      this._embeddedLanguagesRegex = undefined;
    } else {
      escapedScopes.sort();
      escapedScopes.reverse();
      this._embeddedLanguagesRegex = new RegExp(`^((${escapedScopes.join(')|(')}))($|\\.)`, '');
    }
  }

  public onDidChangeTheme(): void {
    this._cache = Object.create(null);
    this._defaultMetaData = new ScopeMetadata('', this._initialLanguage, TemporaryStandardTokenType.Other, [
      this._themeProvider.getDefaults(),
    ]) as any;
  }

  public getDefaultMetadata() {
    return this._defaultMetaData;
  }

  /**
   * Escapes regular expression characters in a given string
   */
  private static _escapeRegExpCharacters(value: string): string {
    return value.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, '\\$&');
  }

  private static _NULL_SCOPE_METADATA = new ScopeMetadata('', 0, 0, undefined);
  public getMetadataForScope(scopeName: string | undefined): ScopeMetadata {
    // never hurts to be too careful
    if (scopeName === null || scopeName === undefined) {
      return ScopeMetadataProvider._NULL_SCOPE_METADATA;
    }
    let value = this._cache[scopeName];
    if (value) {
      return value;
    }
    value = this._doGetMetadataForScope(scopeName);
    this._cache[scopeName] = value;
    return value;
  }

  private _doGetMetadataForScope(scopeName: string): ScopeMetadata {
    const languageId = this._scopeToLanguage(scopeName);
    const standardTokenType = this._toStandardTokenType(scopeName);
    const themeData = this._themeProvider.themeMatch(scopeName);

    return new ScopeMetadata(scopeName, languageId, standardTokenType, themeData);
  }

  /**
   * Given a produced TM scope, return the language that token describes or null if unknown.
   * e.g. source.html => html, source.css.embedded.html => css, punctuation.definition.tag.html => null
   */
  private _scopeToLanguage(scope: string): number {
    if (!scope) {
      return 0;
    }
    if (!this._embeddedLanguagesRegex) {
      // no scopes registered
      return 0;
    }
    const m = scope.match(this._embeddedLanguagesRegex);
    if (!m) {
      // no scopes matched
      return 0;
    }

    const language = this._embeddedLanguages[m[1]] ?? 0;
    if (!language) {
      return 0;
    }

    return language;
  }

  private static STANDARD_TOKEN_TYPE_REGEXP = /\b(comment|string|regex|meta\.embedded)\b/;
  private _toStandardTokenType(tokenType: string): TemporaryStandardTokenType {
    const m = tokenType.match(ScopeMetadataProvider.STANDARD_TOKEN_TYPE_REGEXP);
    if (!m) {
      return TemporaryStandardTokenType.Other;
    }
    switch (m[1]) {
      case 'comment':
        return TemporaryStandardTokenType.Comment;
      case 'string':
        return TemporaryStandardTokenType.String;
      case 'regex':
        return TemporaryStandardTokenType.RegEx;
      case 'meta.embedded':
        return TemporaryStandardTokenType.MetaEmbedded;
    }
    throw new Error('Unexpected match for standard token type!');
  }
}

export class Grammar implements IGrammar, IRuleFactoryHelper {
  /**
   * the rule id of the grammar root
   * @private
   */
  private _rootId: number;
  private _lastRuleId: number;
  private readonly _ruleId2desc: Rule[];
  private readonly _includedGrammars: Record<string, IRawGrammar>;
  private readonly _grammarRepository: IGrammarRepository;
  private readonly _grammar: IRawGrammar;
  private _injections: Injection[];
  private readonly _scopeMetadataProvider: ScopeMetadataProvider;
  private readonly _tokenTypeMatchers: TokenTypeMatcher[];

  constructor(
    grammar: IRawGrammar,
    initialLanguage: number,
    embeddedLanguages: IEmbeddedLanguagesMap | undefined,
    tokenTypes: ITokenTypeMap | undefined,
    grammarRepository: IGrammarRepository & IThemeProvider
  ) {
    this._scopeMetadataProvider = new ScopeMetadataProvider(initialLanguage, grammarRepository, embeddedLanguages);

    this._rootId = -1;
    this._lastRuleId = 0;
    this._ruleId2desc = [];
    this._includedGrammars = {};
    this._grammarRepository = grammarRepository;
    this._grammar = initGrammar(grammar, undefined);

    this._tokenTypeMatchers = [];
    if (tokenTypes) {
      for (const selector of Object.keys(tokenTypes)) {
        const matchers = createMatchers(selector, nameMatcher);
        for (const matcher of matchers) {
          this._tokenTypeMatchers.push({
            matcher: matcher.matcher,
            type: tokenTypes[selector],
          });
        }
      }
    }
  }

  public onDidChangeTheme(): void {
    this._scopeMetadataProvider.onDidChangeTheme();
  }

  public getMetadataForScope(scope: string): ScopeMetadata {
    return this._scopeMetadataProvider.getMetadataForScope(scope);
  }

  public getInjections(): Injection[] {
    if (!this._injections) {
      this._injections = [];
      // add injections from the current grammar
      const rawInjections = this._grammar.injections;
      if (rawInjections) {
        for (const expression in rawInjections) {
          collectInjections(this._injections, expression, rawInjections[expression], this, this._grammar);
        }
      }

      // add injection grammars contributed for the current scope
      if (this._grammarRepository) {
        const injectionScopeNames = this._grammarRepository.injections(this._grammar.scopeName);
        if (injectionScopeNames) {
          injectionScopeNames.forEach((injectionScopeName) => {
            const injectionGrammar = this.getExternalGrammar(injectionScopeName);
            if (injectionGrammar) {
              const selector = injectionGrammar.injectionSelector;
              if (selector) {
                collectInjections(this._injections, selector, injectionGrammar, this, injectionGrammar);
              }
            }
          });
        }
      }
      this._injections.sort((i1, i2) => i1.priority - i2.priority); // sort by priority
    }
    if (this._injections.length === 0) {
      return this._injections;
    }
    return this._injections;
  }

  public registerRule<T extends Rule>(factory: (id: number) => T): T {
    const id = ++this._lastRuleId;
    const result = factory(id);
    this._ruleId2desc[id] = result;
    return result;
  }

  public getRule(patternId: number): Rule {
    return this._ruleId2desc[patternId];
  }

  public getExternalGrammar(scopeName: string, repository?: IRawRepository): IRawGrammar | undefined {
    if (this._includedGrammars[scopeName]) {
      return this._includedGrammars[scopeName];
    } else if (this._grammarRepository) {
      const rawIncludedGrammar = this._grammarRepository.lookup(scopeName);
      if (rawIncludedGrammar) {
        this._includedGrammars[scopeName] = initGrammar(rawIncludedGrammar, repository && repository.$base);
        return this._includedGrammars[scopeName];
      }
    }
  }

  public tokenizeLine(lineText: string, prevState: StackElement | undefined): ITokenizeLineResult {
    const r = this._tokenize(lineText, prevState, false);
    return {
      tokens: r.lineTokens.getResult(r.ruleStack, r.lineLength),
      ruleStack: r.ruleStack,
    };
  }

  public tokenizeLine2(lineText: string, prevState: StackElement | undefined): ITokenizeLineResult2 {
    const r = this._tokenize(lineText, prevState, true);
    return {
      tokens: r.lineTokens.getBinaryResult(r.ruleStack, r.lineLength),
      ruleStack: r.ruleStack,
    };
  }

  private _ensureRulesCompiled():void{
    if (this._rootId === -1) {
      this._rootId = RuleFactory.getCompiledRuleId(this._grammar.repository.$self, this, this._grammar.repository);
    }
  }

  private _tokenize(
    lineText: string,
    prevState: StackElement | undefined,
    emitBinaryTokens: boolean
  ): {lineLength: number; lineTokens: LineTokens; ruleStack: StackElement} {

    this._ensureRulesCompiled();

    let isFirstLine: boolean;
    if (!prevState || prevState === StackElement.NULL) {
      isFirstLine = true;
      const rawDefaultMetadata = this._scopeMetadataProvider.getDefaultMetadata();
      const defaultTheme = rawDefaultMetadata.themeData[0];
      const defaultMetadata = StackElementMetadata.set(
        0,
        rawDefaultMetadata.languageId,
        rawDefaultMetadata.tokenType,
        defaultTheme.fontStyle,
        defaultTheme.foreground,
        defaultTheme.background
      );
      const defaultCustomized = defaultTheme.customized;
      // calculate the metadata of the root scope
      const rootScopeName = this.getRule(this._rootId).getName(undefined, undefined)!;
      const rawRootMetadata = this._scopeMetadataProvider.getMetadataForScope(rootScopeName);
      // merge w/ the default metadata
      const rootMetadataRecord = ScopeListElement.mergeMetadata({
        metadata: defaultMetadata,
        customized: defaultCustomized
      }, undefined, rawRootMetadata);

      const scopeList = new ScopeListElement(undefined, rootScopeName, rootMetadataRecord);

      prevState = new StackElement(undefined, this._rootId, -1, undefined, scopeList, scopeList);
    } else {
      isFirstLine = false;
      prevState.reset();
    }

    lineText = lineText + '\n';
    const onigLineText = new OnigUTF8String(lineText);
    const lineLength = onigLineText.length;
    const lineTokens = new LineTokens(emitBinaryTokens, lineText, this._tokenTypeMatchers);
    const nextState = _tokenizeString(this, onigLineText, isFirstLine, 0, prevState, lineTokens);

    return {
      lineLength: lineLength,
      lineTokens: lineTokens,
      ruleStack: nextState,
    };
  }

  public parse(
    text: string,
    _option?: {
      separators?: string[];
    }
  ): CodeDocument {
    const option =(_option ?? {
      separators: DEFAULT_SEPARATORS,
    }) as {
      separators: string[];
    };

    this._ensureRulesCompiled();

    const rawDefaultMetadata = this._scopeMetadataProvider.getDefaultMetadata();
    const defaultTheme = rawDefaultMetadata.themeData[0];
    const defaultMetadata = StackElementMetadata.set(
      0,
      rawDefaultMetadata.languageId,
      rawDefaultMetadata.tokenType,
      defaultTheme.fontStyle,
      defaultTheme.foreground,
      defaultTheme.background
    );
    const defaultCustomized = defaultTheme.customized;

    const rootRule = this.getRule(this._rootId);
    const rootScopeName = rootRule.getName(undefined, undefined)!;
    const rawRootMetadata = this._scopeMetadataProvider.getMetadataForScope(rootScopeName);
    const rootMetadataRecord = ScopeListElement.mergeMetadata({
      metadata: defaultMetadata,
      customized: defaultCustomized
    }, undefined, rawRootMetadata);

    const scopeList = new ScopeListElement(undefined, rootScopeName, rootMetadataRecord);

    let prevState = new StackElement(undefined, this._rootId, -1, undefined, scopeList, scopeList);
    const textLength = text.length;

    const rootNode = new IncludeOnlyRuleASTNode(
      rootScopeName,
      0,
      textLength,
     )
    rootNode.$impostureLang = rootRule.$impostureLang;

    const codeDocuments = new CodeDocument(text, option.separators, rootNode);
    let workingNode: ASTNode = rootNode;

    codeDocuments.lines.forEach((value, index) => {
      const lineText = value.text + value.lineTerminator;
      const onigText = new OnigUTF8String(lineText);
      if (index !== 0){
        prevState.reset();
      }
      const parsedResult = _parseString(
        this,
        onigText,
        index === 0,
        0,
        codeDocuments.accLineLen(index),
        prevState,
        workingNode
      );
      prevState = parsedResult.stack;
      workingNode = parsedResult.workingNode;
    });

    codeDocuments.traverse((_oneNode) => {
      const oneNode = _oneNode as ASTNode;
      // populate $impostureLangMeta if possible
      oneNode.$impostureLangMeta = {};
      if (typeof oneNode.length === 'number' || typeof oneNode.offset === 'number') {
        oneNode.$impostureLangMeta.range = Range.create(
          codeDocuments.positionAt(oneNode.offset),
          codeDocuments.positionAt(oneNode.offset + oneNode.length)
        );
      }
    });

    return codeDocuments;
  }
}

function handleCaptures(
  grammar: Grammar,
  lineText: OnigUTF8String,
  isFirstLine: boolean,
  stack: StackElement,
  lineTokens: LineTokens,
  captures: CaptureRule[],
  captureIndices: IOnigCaptureIndex[]
): void {
  if (captures.length === 0) {
    return;
  }

  const len = Math.min(captures.length, captureIndices.length);
  const localStack: LocalStackElement[] = [];
  // maxEnd for a capture is the end index of the whole match
  const maxEnd = captureIndices[0].end;

  for (let i = 0; i < len; i++) {
    const captureRule = captures[i];
    if (!captureRule) {
      // Not interested
      continue;
    }

    const captureIndex = captureIndices[i];

    if (captureIndex.length === 0) {
      // Nothing really captured
      continue;
    }

    if (captureIndex.start > maxEnd) {
      // Capture going beyond consumed string
      break;
    }
    // captures might encapsulate with others, thus produce them one by one
    // pop captures while needed
    while (localStack.length > 0 && localStack[localStack.length - 1].endPos <= captureIndex.start) {
      // pop!
      lineTokens.produceFromScopes(localStack[localStack.length - 1].scopes, localStack[localStack.length - 1].endPos);
      localStack.pop();
    }

    if (localStack.length > 0) {
      lineTokens.produceFromScopes(localStack[localStack.length - 1].scopes, captureIndex.start);
    } else {
      lineTokens.produce(stack, captureIndex.start);
    }

    if (captureRule.retokenizeCapturedWithRuleId) {
      // we got included rule beneath this capture rule
      // the capture requires additional matching
      const scopeName = captureRule.getName(lineText.toString(), captureIndices);
      const nameScopesList = stack.contentNameScopesList.push(grammar, scopeName);
      const contentName = captureRule.getContentName(lineText.toString(), captureIndices);
      const contentNameScopesList = nameScopesList.push(grammar, contentName);

      const stackClone = stack.push(
        captureRule.retokenizeCapturedWithRuleId,
        captureIndex.start,
        undefined,
        nameScopesList,
        contentNameScopesList
      );
      _tokenizeString(
        grammar,
        new OnigUTF8String(lineText.substring(0, captureIndex.end)),
        isFirstLine && captureIndex.start === 0,
        captureIndex.start,
        stackClone,
        lineTokens
      );
      continue;
    }

    const captureRuleScopeName = captureRule.getName(lineText.toString(), captureIndices);
    if (!!captureRuleScopeName) {
      // push
      const base = localStack.length > 0 ? localStack[localStack.length - 1].scopes : stack.contentNameScopesList;
      const captureRuleScopesList = base.push(grammar, captureRuleScopeName);
      localStack.push(new LocalStackElement(captureRuleScopesList, captureIndex.end));
    }
  }

  while (localStack.length > 0) {
    // pop!
    lineTokens.produceFromScopes(localStack[localStack.length - 1].scopes, localStack[localStack.length - 1].endPos);
    localStack.pop();
  }
}

interface IMatchInjectionsResult {
  readonly priorityMatch: boolean;
  readonly captureIndices: IOnigCaptureIndex[];
  readonly matchedRuleId: number;
}

function debugCompiledRuleToString(ruleScanner: ICompiledRule): string {
  const r: string[] = [];
  for (let i = 0, len = ruleScanner.rules.length; i < len; i++) {
    r.push('   - ' + ruleScanner.rules[i] + ': ' + ruleScanner.debugRegExps[i]);
  }
  return r.join('\n');
}

function matchInjections(
  injections: Injection[],
  grammar: Grammar,
  lineText: OnigUTF8String,
  isFirstLine: boolean,
  linePos: number,
  stack: StackElement,
  anchorPosition: number
): IMatchInjectionsResult | undefined {
  // The lower the better
  let bestMatchRating = Number.MAX_VALUE;
  let bestMatchCaptureIndices: IOnigCaptureIndex[] | undefined = undefined;
  let bestMatchRuleId: number;
  let bestMatchResultPriority = 0;

  const scopes = stack.contentNameScopesList.generateScopes();

  for (let i = 0, len = injections.length; i < len; i++) {
    const injection = injections[i];
    if (!injection.matcher(scopes)) {
      // injection selector doesn't match stack
      continue;
    }
    const ruleScanner = grammar
      .getRule(injection.ruleId)
      .compile(grammar, undefined, isFirstLine, linePos === anchorPosition);
    const matchResult = ruleScanner.scanner.findNextMatchSync(lineText, linePos);
    if (debug.IN_DEBUG_MODE) {
      console.log('  scanning for injections');
      console.log(debugCompiledRuleToString(ruleScanner));
    }

    if (!matchResult) {
      continue;
    }

    const matchRating = matchResult.captureIndices[0].start;
    if (matchRating >= bestMatchRating) {
      // Injections are sorted by priority, so the previous injection had a better or equal priority
      continue;
    }

    bestMatchRating = matchRating;
    bestMatchCaptureIndices = matchResult.captureIndices;
    bestMatchRuleId = ruleScanner.rules[matchResult.index];
    bestMatchResultPriority = injection.priority;

    if (bestMatchRating === linePos) {
      // No more need to look at the rest of the injections.
      break;
    }
  }

  if (bestMatchCaptureIndices) {
    return {
      priorityMatch: bestMatchResultPriority === -1,
      captureIndices: bestMatchCaptureIndices,
      matchedRuleId: bestMatchRuleId!,
    };
  }

  return undefined;
}

interface IMatchResult {
  readonly captureIndices: IOnigCaptureIndex[];
  readonly matchedRuleId: number;
}

function matchRule(
  grammar: Grammar,
  lineText: OnigUTF8String,
  isFirstLine: boolean,
  linePos: number,
  stack: StackElement,
  anchorPosition: number
): IMatchResult | undefined {
  const rule = stack.getRule(grammar);
  const ruleScanner = rule.compile(grammar, stack.endRule, isFirstLine, linePos === anchorPosition);
  const r = ruleScanner.scanner.findNextMatchSync(lineText, linePos);
  if (debug.IN_DEBUG_MODE) {
    console.log('  scanning for');
    console.log(debugCompiledRuleToString(ruleScanner));
  }

  if (r) {
    return {
      captureIndices: r.captureIndices,
      matchedRuleId: ruleScanner.rules[r.index],
    };
  }
  return undefined;
}

function matchRuleOrInjections(
  grammar: Grammar,
  lineText: OnigUTF8String,
  isFirstLine: boolean,
  linePos: number,
  stack: StackElement,
  anchorPosition: number
): IMatchResult | undefined {
  // Look for normal grammar rule
  const matchResult = matchRule(grammar, lineText, isFirstLine, linePos, stack, anchorPosition);

  // Look for injected rules
  const injections = grammar.getInjections();
  if (injections.length === 0) {
    // No injections whatsoever => early return
    return matchResult;
  }

  const injectionResult = matchInjections(injections, grammar, lineText, isFirstLine, linePos, stack, anchorPosition);
  if (!injectionResult) {
    // No injections matched => early return
    return matchResult;
  }

  if (!matchResult) {
    // Only injections matched => early return
    return injectionResult;
  }

  // Decide if `matchResult` or `injectionResult` should win
  const matchResultScore = matchResult.captureIndices[0].start;
  const injectionResultScore = injectionResult.captureIndices[0].start;

  if (
    injectionResultScore < matchResultScore ||
    (injectionResult.priorityMatch && injectionResultScore === matchResultScore)
  ) {
    // injection won!
    return injectionResult;
  }
  return matchResult;
}

interface IWhileStack {
  readonly stack: StackElement;
  readonly rule: BeginWhileRule;
}

interface IWhileCheckResult {
  readonly stack: StackElement;
  readonly linePos: number;
  readonly anchorPosition: number;
  readonly isFirstLine: boolean;
}

/**
 * Walk the stack from bottom to top, and check each while condition in this order.
 * If any fails, cut off the entire stack above the failed while condition. While conditions
 * may also advance the linePosition.
 */
function _checkWhileConditions(
  grammar: Grammar,
  lineText: OnigUTF8String,
  isFirstLine: boolean,
  linePos: number,
  stack: StackElement,
  lineTokens: LineTokens
): IWhileCheckResult {
  let anchorPosition = -1;
  const whileRules: IWhileStack[] = [];
  // collect all the whileRules from stack of scopeList
  for (let node = stack; node; node = node.pop()) {
    const nodeRule = node.getRule(grammar);
    if (nodeRule instanceof BeginWhileRule) {
      whileRules.push({
        rule: nodeRule,
        stack: node,
      });
    }
  }
  // match each while rule found in the current stack list
  for (let whileRule = whileRules.pop(); whileRule; whileRule = whileRules.pop()) {
    const ruleScanner = whileRule.rule.compileWhile(
      grammar,
      whileRule.stack.endRule!,
      isFirstLine,
      anchorPosition === linePos
    );
    const r = ruleScanner.scanner.findNextMatchSync(lineText, linePos);
    if (debug.IN_DEBUG_MODE) {
      console.log('  scanning for while rule');
      console.log(debugCompiledRuleToString(ruleScanner));
    }

    if (r) {
      const matchedRuleId = ruleScanner.rules[r.index];
      if (matchedRuleId !== -2) {
        // we should never reach over here, it must be a whileRule,
        // but it does no harm while being cautious
        stack = whileRule.stack.pop();
        break;
      }
      if (r.captureIndices && r.captureIndices.length) {
        lineTokens.produce(whileRule.stack, r.captureIndices[0].start);
        handleCaptures(
          grammar,
          lineText,
          isFirstLine,
          whileRule.stack,
          lineTokens,
          whileRule.rule.whileCaptures,
          r.captureIndices
        );
        lineTokens.produce(whileRule.stack, r.captureIndices[0].end);
        anchorPosition = r.captureIndices[0].end;
        if (r.captureIndices[0].end > linePos) {
          linePos = r.captureIndices[0].end;
          isFirstLine = false;
        }
      }
    } else {
      // pop of to the parent of the while rule if it doesn't match the while rule
      stack = whileRule.stack.pop();
      break;
    }
  }

  return {stack: stack, linePos: linePos, anchorPosition: anchorPosition, isFirstLine: isFirstLine};
}

function _tokenizeString(
  grammar: Grammar,
  lineText: OnigUTF8String,
  isFirstLine: boolean,
  linePos: number,
  stack: StackElement,
  lineTokens: LineTokens
): StackElement {
  const lineLength = lineText.length;

  let STOP = false;

  const whileCheckResult = _checkWhileConditions(grammar, lineText, isFirstLine, linePos, stack, lineTokens);
  stack = whileCheckResult.stack;
  linePos = whileCheckResult.linePos;
  isFirstLine = whileCheckResult.isFirstLine;
  let anchorPosition = whileCheckResult.anchorPosition;

  while (!STOP) {
    scanNext(); // potentially modifies linePos && anchorPosition
  }

  function scanNext(): void {
    if (debug.IN_DEBUG_MODE) {
      console.log('');
      console.log('@@scanNext: |' + lineText.toString().replace(/\n$/, '\\n').substring(linePos) + '|');
    }
    const r = matchRuleOrInjections(grammar, lineText, isFirstLine, linePos, stack, anchorPosition);

    if (!r) {
      if (debug.IN_DEBUG_MODE) {
        console.log('  no more matches.');
      }
      // No match
      lineTokens.produce(stack, lineLength);
      STOP = true;
      return;
    }

    const captureIndices: IOnigCaptureIndex[] = r.captureIndices;
    const matchedRuleId: number = r.matchedRuleId;

    const hasAdvanced = captureIndices && captureIndices.length > 0 ? captureIndices[0].end > linePos : false;

    if (matchedRuleId === -1) {
      // We matched the `end` for this rule => pop it
      const poppedRule = <BeginEndRule>stack.getRule(grammar);

      if (debug.IN_DEBUG_MODE) {
        console.log('  popping ' + poppedRule.debugName + ' - ' + poppedRule.debugEndRegExp);
      }

      lineTokens.produce(stack, captureIndices[0].start);
      stack = stack.setContentNameScopesList(stack.nameScopesList);
      handleCaptures(grammar, lineText, isFirstLine, stack, lineTokens, poppedRule.endCaptures, captureIndices);
      lineTokens.produce(stack, captureIndices[0].end);

      // pop
      const popped = stack;
      stack = stack.pop();

      if (!hasAdvanced && popped.getEnterPos() === linePos) {
        // Grammar pushed & popped a rule without advancing
        console.error('[1] - Grammar is in an endless loop - Grammar pushed & popped a rule without advancing');

        // See https://github.com/Microsoft/vscode-textmate/issues/12
        // Let's assume this was a mistake by the grammar author and the intent was to continue in this state
        stack = popped;

        lineTokens.produce(stack, lineLength);
        STOP = true;
        return;
      }
    } else {
      // We matched a rule!
      const _rule = grammar.getRule(matchedRuleId);
      // produce a token of the current stack
      lineTokens.produce(stack, captureIndices[0].start);

      const beforePush = stack;
      // push it on the stack rule
      const scopeName = _rule.getName(lineText.toString(), captureIndices);
      const nameScopesList = stack.contentNameScopesList.push(grammar, scopeName);
      // populate identical name scope and name content scope and setContentNameScopesList latter if needed
      // like, the contentName is defined on the corresponding rule
      stack = stack.push(matchedRuleId, linePos, undefined, nameScopesList, nameScopesList);

      if (_rule instanceof BeginEndRule) {
        const pushedRule = <BeginEndRule>_rule;
        if (debug.IN_DEBUG_MODE) {
          console.log('  pushing ' + pushedRule.debugName + ' - ' + pushedRule.debugBeginRegExp);
        }

        handleCaptures(grammar, lineText, isFirstLine, stack, lineTokens, pushedRule.beginCaptures, captureIndices);
        lineTokens.produce(stack, captureIndices[0].end);
        anchorPosition = captureIndices[0].end;

        const contentName = pushedRule.getContentName(lineText.toString(), captureIndices);
        const contentNameScopesList = nameScopesList.push(grammar, contentName);
        stack = stack.setContentNameScopesList(contentNameScopesList);

        if (pushedRule.endHasBackReferences) {
          stack = stack.setEndRule(pushedRule.getEndWithResolvedBackReferences(lineText.toString(), captureIndices));
        }

        if (!hasAdvanced && beforePush.hasSameRuleAs(stack)) {
          // Grammar pushed the same rule without advancing
          console.error('[2] - Grammar is in an endless loop - Grammar pushed the same rule without advancing');
          stack = stack.pop();
          lineTokens.produce(stack, lineLength);
          STOP = true;
          return;
        }
      } else if (_rule instanceof BeginWhileRule) {
        const pushedRule = <BeginWhileRule>_rule;
        if (debug.IN_DEBUG_MODE) {
          console.log('  pushing ' + pushedRule.debugName);
        }

        handleCaptures(grammar, lineText, isFirstLine, stack, lineTokens, pushedRule.beginCaptures, captureIndices);
        lineTokens.produce(stack, captureIndices[0].end);
        anchorPosition = captureIndices[0].end;

        const contentName = pushedRule.getContentName(lineText.toString(), captureIndices);
        const contentNameScopesList = nameScopesList.push(grammar, contentName);
        stack = stack.setContentNameScopesList(contentNameScopesList);

        if (pushedRule.whileHasBackReferences) {
          stack = stack.setEndRule(pushedRule.getWhileWithResolvedBackReferences(lineText.toString(), captureIndices));
        }

        if (!hasAdvanced && beforePush.hasSameRuleAs(stack)) {
          // Grammar pushed the same rule without advancing
          console.error('[3] - Grammar is in an endless loop - Grammar pushed the same rule without advancing');
          stack = stack.pop();
          lineTokens.produce(stack, lineLength);
          STOP = true;
          return;
        }
      } else {
        const matchingRule = <MatchRule>_rule;
        if (debug.IN_DEBUG_MODE) {
          console.log('  matched ' + matchingRule.debugName + ' - ' + matchingRule.debugMatchRegExp);
        }

        handleCaptures(grammar, lineText, isFirstLine, stack, lineTokens, matchingRule.captures, captureIndices);
        lineTokens.produce(stack, captureIndices[0].end);

        // pop rule immediately since it is a MatchRule
        stack = stack.pop();

        if (!hasAdvanced) {
          // Grammar is not advancing, nor is it pushing/popping
          console.error('[4] - Grammar is in an endless loop - Grammar is not advancing, nor is it pushing/popping');
          stack = stack.safePop();
          lineTokens.produce(stack, lineLength);
          STOP = true;
          return;
        }
      }
    }

    if (captureIndices[0].end > linePos) {
      // Advance stream
      linePos = captureIndices[0].end;
      isFirstLine = false;
    }
  }

  return stack;
}

function _ensureMutableASTNodeChildren(node: ASTNode) {
  if (!Array.isArray(node.children)) {
    node.children = [];
  }
}

function _parseWhileConditions(
  grammar: Grammar,
  lineText: OnigUTF8String,
  isFirstLine: boolean,
  linePos: number,
  lineOffset: number,
  stack: StackElement,
  parent: ASTNode
): IWhileCheckResult {
  let anchorPosition = -1;
  const whileRules: IWhileStack[] = [];
  for (let node = stack; node; node = node.pop()) {
    const nodeRule = node.getRule(grammar);
    if (nodeRule instanceof BeginWhileRule) {
      whileRules.push({
        rule: nodeRule,
        stack: node,
      });
    }
  }

  for (let whileRule = whileRules.pop(); whileRule; whileRule = whileRules.pop()) {
    const ruleScanner = whileRule.rule.compileWhile(
      grammar,
      whileRule.stack.endRule!,
      isFirstLine,
      anchorPosition === linePos
    );
    const r = ruleScanner.scanner.findNextMatchSync(lineText, linePos);
    if (debug.IN_DEBUG_MODE) {
      console.log('Parser   scanning for while rule');
      console.log(debugCompiledRuleToString(ruleScanner));
    }

    if (r) {
      const matchedRuleId = ruleScanner.rules[r.index];
      if (matchedRuleId !== -2) {
        // we shouldn't end up here
        stack = whileRule.stack.pop();
        break;
      }
      if (r.captureIndices && r.captureIndices.length) {
        const beginWhileRule = whileRule.rule;
        const scopeName = beginWhileRule.getName(lineText.toString(), r.captureIndices)!;

        const beginWhileNode = new BeginWhileRuleASTNode(
          'while',
          scopeName,
          lineOffset + r.captureIndices[0].start,
          r.captureIndices[0].length,
          parent
        );
        beginWhileNode.$impostureLang = beginWhileRule.$impostureLang;
        beginWhileNode.whileCaptureChildren = _parseCaptures(
          grammar,
          lineText,
          isFirstLine,
          lineOffset,
          whileRule.stack,
          beginWhileNode,
          whileRule.rule.whileCaptures,
          r.captureIndices
        );
        _ensureMutableASTNodeChildren(parent);
        parent.children.push(beginWhileNode);

        anchorPosition = r.captureIndices[0].end;

        if (r.captureIndices[0].end > linePos) {
          linePos = r.captureIndices[0].end;
          isFirstLine = false;
        }
      }
    } else {
      stack = whileRule.stack.pop();
      break;
    }
  }
  return {stack: stack, linePos: linePos, anchorPosition: anchorPosition, isFirstLine: isFirstLine};
}

function _parseCaptures(
  grammar: Grammar,
  text: OnigUTF8String,
  isFirstLine: boolean,
  lineOffset: number,
  stack: StackElement,
  parent: ASTNode,
  captures: CaptureRule[],
  captureIndices: IOnigCaptureIndex[]
): ASTNode[] {
  if (captures.length === 0) {
    return [];
  }
  const len = Math.min(captures.length, captureIndices.length);
  const result: ASTNode[] = [];
  // the first capture index is the whole match
  const maxEnd = captureIndices[0].end;

  for (let i = 0; i < len; i++) {
    const captureRule = captures[i];
    if (!captureRule) {
      // Not interested
      continue;
    }

    const captureIndex = captureIndices[i];

    if (captureIndex.length === 0) {
      // Nothing really captured
      continue;
    }

    if (captureIndex.start > maxEnd) {
      // Capture going beyond consumed string
      break;
    }

    if (captureRule.retokenizeCapturedWithRuleId) {
      // the capture requires additional matching
      const scopeName = captureRule.getName(text.toString(), captureIndices)!;
      const theOne = new CaptureRuleASTNode(
        scopeName,
        lineOffset + captureIndex.start,
        captureIndex.length,
        parent
      );
      theOne.$impostureLang = captureRule.$impostureLang;
      const stackClone = stack.push(captureRule.retokenizeCapturedWithRuleId, captureIndex.start, undefined);
      _parseString(
        grammar,
        new OnigUTF8String(text.substring(0, captureIndex.end)),
        isFirstLine,
        captureIndex.start,
        lineOffset,
        stackClone,
        theOne
      );
      result.push(theOne);
      continue;
    }

    const captureRuleScopeName = captureRule.getName(text.toString(), captureIndices)!;
    if (!!captureRuleScopeName) {
      // push
      const toBePushed = new CaptureRuleASTNode(
        captureRuleScopeName,
        lineOffset + captureIndex.start,
        captureIndex.length,
        parent
      )
      toBePushed.$impostureLang = captureRule.$impostureLang;
      result.push(toBePushed);
    }
  }
  return result;
}

function _parseString(
  grammar: Grammar,
  lineText: OnigUTF8String,
  isFirstLine: boolean,
  linePos: number,
  lineOffset: number,
  stack: StackElement,
  parent: ASTNode
) {
  // const textLength = text.length;
  let workingNode: ASTNode = parent;

  let STOP = false;
  const whileCheckResult = _parseWhileConditions(grammar, lineText, isFirstLine, linePos, lineOffset, stack, parent);
  stack = whileCheckResult.stack;
  linePos = whileCheckResult.linePos;
  isFirstLine = whileCheckResult.isFirstLine;
  let anchorPosition = whileCheckResult.anchorPosition;

  while (!STOP) {
    doParse();
  }

  function doParse() {
    if (debug.IN_DEBUG_MODE) {
      console.log('');
      console.log('@@doParse: |' + lineText.toString().replace(/\n$/, '\\n').substring(linePos) + '|');
    }
    const r = matchRuleOrInjections(grammar, lineText, isFirstLine, linePos, stack, anchorPosition);

    if (!r) {
      if (debug.IN_DEBUG_MODE) {
        console.log('  no more matches.');
      }
      // No match
      STOP = true;
      return;
    }
    const captureIndices: IOnigCaptureIndex[] = r.captureIndices;
    const matchedRuleId: number = r.matchedRuleId;
    const hasAdvanced = captureIndices && captureIndices.length > 0 ? captureIndices[0].end > linePos : false;

    if (matchedRuleId === -1) {
      // We matched the `end` for this rule => pop it
      const poppedRule = <BeginEndRule>stack.getRule(grammar);
      if (debug.IN_DEBUG_MODE) {
        console.log('Parser   popping ' + poppedRule.debugName + ' - ' + poppedRule.debugEndRegExp);
      }

      if (workingNode.type !== 'BeginEndRule') {
        console.error('Parser [1.1] - Grammar is incorrect - Grammar tied to pop a non-begin-end rule.');
        STOP = true;
        return;
      }
      workingNode.endCaptureChildren = _parseCaptures(
        grammar,
        lineText,
        isFirstLine,
        lineOffset,
        stack,
        workingNode,
        poppedRule.endCaptures,
        captureIndices
      );
      workingNode.length = lineOffset + captureIndices[0].end - workingNode.offset;
      workingNode = workingNode.parent!;
      const popped = stack;
      stack = stack.pop();

      if (!hasAdvanced && popped.getEnterPos() === linePos) {
        // Grammar pushed & popped a rule without advancing
        console.error('Parser [1.2] - Grammar is in an endless loop - Grammar pushed & popped a rule without advancing');

        // See https://github.com/Microsoft/vscode-textmate/issues/12
        // Let's assume this was a mistake by the grammar author and the intent was to continue in this state
        stack = popped;
        STOP = true;
        return;
      }
    } else {
      // alright, we gotta match rule
      const _rule = grammar.getRule(matchedRuleId);
      if (
        workingNode.children?.length &&
        typeof workingNode.children[workingNode.children.length - 1].length !== 'number'
      ) {
        workingNode.children[workingNode.children.length - 1].length =
          lineOffset + captureIndices[0].start - workingNode.children[workingNode.children.length - 1].offset;
      }
      const beforePush = stack;
      const scopeName = _rule.getName(lineText.toString(), captureIndices)!;
      stack = stack.push(matchedRuleId, linePos, undefined);

      if (_rule instanceof BeginEndRule) {
        const pushedRule = <BeginEndRule>_rule;
        if (debug.IN_DEBUG_MODE) {
          console.log('Parser   pushing ' + pushedRule.debugName + ' - ' + pushedRule.debugBeginRegExp);
        }
        const beginEndNode = new BeginEndRuleASTNode(
          scopeName,
          lineOffset + captureIndices[0].start
        );
        beginEndNode.parent = workingNode;
        beginEndNode.$impostureLang = pushedRule.$impostureLang;
        beginEndNode.beginCaptureChildren = _parseCaptures(
          grammar,
          lineText,
          isFirstLine,
          lineOffset,
          stack,
          beginEndNode,
          pushedRule.beginCaptures,
          captureIndices
        );
        _ensureMutableASTNodeChildren(workingNode);
        workingNode.children.push(beginEndNode);
        workingNode = beginEndNode;
        anchorPosition = captureIndices[0].end;

        if (pushedRule.endHasBackReferences) {
          stack = stack.setEndRule(pushedRule.getEndWithResolvedBackReferences(lineText.toString(), captureIndices));
        }

        if (!hasAdvanced && beforePush.hasSameRuleAs(stack)) {
          // Grammar pushed the same rule without advancing
          console.error('Parser [2] - Grammar is in an endless loop - Grammar pushed the same rule without advancing');
          stack = stack.pop();
          STOP = true;
          return;
        }
      } else if (_rule instanceof BeginWhileRule) {
        const pushedRule = <BeginWhileRule>_rule;
        if (debug.IN_DEBUG_MODE) {
          console.log('Parser   pushing ' + pushedRule.debugName);
        }
        const beginWhileNode = new BeginWhileRuleASTNode(
          'begin',
          scopeName,
          lineOffset + captureIndices[0].start,
          captureIndices[0].length,
          workingNode,
        );
        beginWhileNode.$impostureLang = pushedRule.$impostureLang;
        beginWhileNode.beginCaptureChildren = _parseCaptures(
          grammar,
          lineText,
          isFirstLine,
          lineOffset,
          stack,
          beginWhileNode,
          pushedRule.beginCaptures,
          captureIndices
        );
        _ensureMutableASTNodeChildren(workingNode);
        workingNode.children.push(beginWhileNode);
        anchorPosition = captureIndices[0].end;

        if (pushedRule.whileHasBackReferences) {
          stack = stack.setEndRule(pushedRule.getWhileWithResolvedBackReferences(lineText.toString(), captureIndices));
        }

        if (!hasAdvanced && beforePush.hasSameRuleAs(stack)) {
          // Grammar pushed the same rule without advancing
          console.error('Parser [3] - Grammar is in an endless loop - Grammar pushed the same rule without advancing');
          stack = stack.pop();
          STOP = true;
          return;
        }
      } else {
        // match only, append to children
        const matchingRule = <MatchRule>_rule;
        if (debug.IN_DEBUG_MODE) {
          console.log('Parser   matched ' + matchingRule.debugName + ' - ' + matchingRule.debugMatchRegExp);
        }
        const matchingNode = new MatchRuleASTNode(
          scopeName,
          lineOffset + captureIndices[0].start,
          captureIndices[0].length,
          workingNode,
        )
        matchingNode.$impostureLang = matchingRule.$impostureLang;
        matchingNode.children = _parseCaptures(
          grammar,
          lineText,
          isFirstLine,
          lineOffset,
          stack,
          matchingNode,
          matchingRule.captures,
          captureIndices
        );
        // anchorPosition = captureIndices[0].end;

        stack = stack.pop();
        _ensureMutableASTNodeChildren(workingNode);
        workingNode.children.push(matchingNode);

        if (!hasAdvanced) {
          console.error(
            'Parser [4] - Grammar is in an endless loop - Grammar is not advancing, nor is it pushing/popping'
          );
          stack = stack.safePop();
          // emmm.......should i put an error rule here?
          STOP = true;
          return;
        }
      }
    }

    if (captureIndices[0].end > linePos) {
      // Advance stream
      linePos = captureIndices[0].end;
      isFirstLine = false;
    }
  }

  return {
    workingNode,
    stack,
  };
}

/**
 * Stack element integer metadata static utils
 */
export class StackElementMetadata {
  public static toBinaryStr(metadata: number): string {
    let r = metadata.toString(2);
    while (r.length < 32) {
      r = '0' + r;
    }
    return r;
  }

  public static printMetadata(metadata: number): void {
    const languageId = StackElementMetadata.getLanguageId(metadata);
    const tokenType = StackElementMetadata.getTokenType(metadata);
    const fontStyle = StackElementMetadata.getFontStyle(metadata);
    const foreground = StackElementMetadata.getForeground(metadata);
    const background = StackElementMetadata.getBackground(metadata);

    console.log({
      languageId: languageId,
      tokenType: tokenType,
      fontStyle: fontStyle,
      foreground: foreground,
      background: background,
    });
  }

  public static getLanguageId(metadata: number): number {
    return (metadata & MetadataConsts.LANGUAGEID_MASK) >>> MetadataConsts.LANGUAGEID_OFFSET;
  }

  public static getTokenType(metadata: number): number {
    return (metadata & MetadataConsts.TOKEN_TYPE_MASK) >>> MetadataConsts.TOKEN_TYPE_OFFSET;
  }

  public static getFontStyle(metadata: number): number {
    return (metadata & MetadataConsts.FONT_STYLE_MASK) >>> MetadataConsts.FONT_STYLE_OFFSET;
  }

  public static getForeground(metadata: number): number {
    return (metadata & MetadataConsts.FOREGROUND_MASK) >>> MetadataConsts.FOREGROUND_OFFSET;
  }

  public static getBackground(metadata: number): number {
    return (metadata & MetadataConsts.BACKGROUND_MASK) >>> MetadataConsts.BACKGROUND_OFFSET;
  }

  public static set(
    metadata: number,
    languageId: number,
    tokenType: TemporaryStandardTokenType,
    fontStyle: FontStyle,
    foreground: number,
    background: number
  ): number {
    let _languageId = StackElementMetadata.getLanguageId(metadata);
    let _tokenType = StackElementMetadata.getTokenType(metadata);
    let _fontStyle = StackElementMetadata.getFontStyle(metadata);
    let _foreground = StackElementMetadata.getForeground(metadata);
    let _background = StackElementMetadata.getBackground(metadata);

    if (languageId !== 0) {
      _languageId = languageId;
    }
    if (tokenType !== TemporaryStandardTokenType.Other) {
      _tokenType = tokenType === TemporaryStandardTokenType.MetaEmbedded ? StandardTokenType.Other : tokenType;
    }
    if (fontStyle !== FontStyle.NotSet) {
      _fontStyle = fontStyle;
    }
    if (foreground !== 0) {
      _foreground = foreground;
    }
    if (background !== 0) {
      _background = background;
    }

    return (
      ((_languageId << MetadataConsts.LANGUAGEID_OFFSET) |
        (_tokenType << MetadataConsts.TOKEN_TYPE_OFFSET) |
        (_fontStyle << MetadataConsts.FONT_STYLE_OFFSET) |
        (_foreground << MetadataConsts.FOREGROUND_OFFSET) |
        (_background << MetadataConsts.BACKGROUND_OFFSET)) >>>
      0
    );
  }
}

interface ScopeListElementMetadata{
  metadata: number,
  customized?: Record<string, any>
}

/**
 * Immutable scope list element holds the list of scopes and their matched metadata.
 */
export class ScopeListElement {
  // _scopeListElementBrand: void;

  constructor(
    public readonly parent: ScopeListElement | undefined,
    public readonly scope: string,
    public readonly metadataRecord: ScopeListElementMetadata
  ) {}

  private static _equals(a: ScopeListElement, b: ScopeListElement): boolean {
    do {
      if (a === b) {
        return true;
      }

      if (a.scope !== b.scope || a.metadataRecord.metadata !== b.metadataRecord.metadata) {
        return false;
      }

      // Go to previous pair
      a = a.parent as any;
      b = b.parent as any;

      // unsafe a, b might be null

      if (!a && !b) {
        // End of list reached for both
        return true;
      }

      if (!a || !b) {
        // End of list reached only for one
        return false;
      }
      // safe a, b cannot be null

    } while (true);
  }

  public equals(other: ScopeListElement): boolean {
    return ScopeListElement._equals(this, other);
  }

  private static _matchesScope(scope: string, selector: string, selectorWithDot: string): boolean {
    return selector === scope || scope.substring(0, selectorWithDot.length) === selectorWithDot;
  }

  private static _matches(target: ScopeListElement | undefined, parentScopes: string[] | undefined): boolean {
    if (!parentScopes) {
      return true;
    }
    // todo parent scopes and target scopeList were compared over here, enhance it
    // enhance it to support and scope1>

    const len = parentScopes.length;
    let index = 0;
    let selector = parentScopes[index];
    let selectorWithDot = selector + '.';

    while (target) {
      if (this._matchesScope(target.scope, selector, selectorWithDot)) {
        index++;
        if (index === len) {
          return true;
        }
        selector = parentScopes[index];
        selectorWithDot = selector + '.';
      }
      target = target.parent;
    }

    return false;
  }

  /**
   * Merge any matching rules' metadata into current target metadata
   *
   * @param metadataRecord        current target metadata record
   * @param scopesList            current scope list element
   * @param source                the source ScopeMetadata holding the rule might be matched
   * @return mergedMetaData       the number of merged metadata
   */
  public static mergeMetadata(
    metadataRecord: ScopeListElementMetadata, scopesList: ScopeListElement | undefined, source: ScopeMetadata | undefined
  ): ScopeListElementMetadata {
    if (!source) {
      return metadataRecord;
    }

    let fontStyle = FontStyle.NotSet;
    let foreground = 0;
    let background = 0;
    let customized: Record<string, any> | undefined = undefined;

    if (!!source.themeData) {
      // Find the first themeData that matches
      for (let i = 0, len = source.themeData.length; i < len; i++) {
        const themeData = source.themeData[i];

        if (this._matches(scopesList, themeData.parentScopes)) {
          fontStyle = themeData.fontStyle;
          foreground = themeData.foreground;
          background = themeData.background;
          customized = themeData.customized;
          break;
        }
      }
    }

    return {
      metadata:StackElementMetadata.set(metadataRecord.metadata, source.languageId, source.tokenType, fontStyle, foreground, background),
      customized
    }
  }

  private static _push(target: ScopeListElement, grammar: Grammar, scopes: string[]): ScopeListElement {
    for (let i = 0, len = scopes.length; i < len; i++) {
      const scope = scopes[i];
      const rawMetadata = grammar.getMetadataForScope(scope);
      const metadata = ScopeListElement.mergeMetadata(target.metadataRecord, target, rawMetadata);
      target = new ScopeListElement(target, scope, metadata);
    }
    return target;
  }

  /**
   * Append scope/scopes to the current list
   *
   * @param grammar
   * @param scope     a single scopeName or multiple scopeName seperated by space
   */
  public push(grammar: Grammar, scope: string | undefined): ScopeListElement {
    if (scope === null || scope === undefined) {
      // cannot push empty, return self
      return this;
    }
    if (scope.indexOf(' ') >= 0) {
      // there are multiple scopes to push
      return ScopeListElement._push(this, grammar, scope.split(/ /g));
    }
    // there is a single scope to push
    return ScopeListElement._push(this, grammar, [scope]);
  }

  private static _generateScopes(scopesList: ScopeListElement | undefined): string[] {
    const result: string[] = [];
    let resultLen = 0;
    while (scopesList) {
      result[resultLen++] = scopesList.scope;
      scopesList = scopesList.parent;
    }
    result.reverse();
    return result;
  }

  /**
   * Generate scopes of current list descending like:
   *    segment1.segment2.segment3
   *    segment1.segment2
   *    segment1
   */
  public generateScopes(): string[] {
    return ScopeListElement._generateScopes(this);
  }
}

/**
 * Represents a "pushed" state on the stack (as a linked list element).
 */
export class StackElement implements StackElementDef {
  _stackElementBrand: void;

  /**
   * Ad-hoc NULL stack element
   */
  public static NULL = new StackElement(undefined, 0, 0, undefined, undefined as any, undefined as any);

  /**
   * The position on the current line where this state was pushed.
   * This is relevant only while tokenizing a line, to detect endless loops.
   * Its value is meaningless across lines.
   */
  private _enterPos: number;

  /**
   * The previous state on the stack (or null for the root state).
   */
  public readonly parent?: StackElement;
  /**
   * The depth of the stack.
   */
  public readonly depth: number;

  /**
   * The state (rule) that this element represents.
   */
  public readonly ruleId: number;
  /**
   * The "pop" (end) condition for this state in case that it was dynamically generated through captured text.
   */
  public readonly endRule?: string;
  /**
   * The list of scopes containing the "name" for this state.
   */
  public readonly nameScopesList: ScopeListElement;
  /**
   * The list of scopes containing the "contentName" (besides "name") for this state.
   * This list **must** contain as an element `scopeName`.
   * todo: consider deprecate it
   */
  public readonly contentNameScopesList: ScopeListElement;

  constructor(
    parent: StackElement | undefined,
    ruleId: number,
    enterPos: number,
    endRule: string | undefined,
    nameScopesList: ScopeListElement,
    contentNameScopesList: ScopeListElement
  ) {
    this.parent = parent;
    this.depth = this.parent ? this.parent.depth + 1 : 1;
    this.ruleId = ruleId;
    this._enterPos = enterPos;
    this.endRule = endRule;
    this.nameScopesList = nameScopesList;
    this.contentNameScopesList = contentNameScopesList;
  }

  /**
   * A structural equals check. Does not take into account `scopes`.
   */
  private static _structuralEquals(a: StackElement, b: StackElement): boolean {
    do {
      if (a === b) {
        return true;
      }

      if (a.depth !== b.depth || a.ruleId !== b.ruleId || a.endRule !== b.endRule) {
        return false;
      }

      // Go to previous pair
      a = a.parent as any;
      b = b.parent as any;

      // unsafe a, b might be null
      if (!a && !b) {
        // End of list reached for both
        return true;
      }

      if (!a || !b) {
        // End of list reached only for one
        return false;
      }
      // safe a, b cannot be null

    } while (true);
  }

  private static _equals(a: StackElement, b: StackElement): boolean {
    if (a === b) {
      return true;
    }
    if (!this._structuralEquals(a, b)) {
      return false;
    }
    return a.contentNameScopesList.equals(b.contentNameScopesList);
  }

  public clone(): StackElement {
    return this;
  }

  public equals(other: StackElement): boolean {
    if (!other) {
      return false;
    }
    return StackElement._equals(this, other);
  }

  private static _reset(_el: StackElement): void {
    let el:StackElement | undefined = _el;
    while (el) {
      el._enterPos = -1;
      el = el.parent;
    }
  }

  public reset(): void {
    StackElement._reset(this);
  }

  public pop(): StackElement {
    // cannot pop root stack
    return this.parent!;
  }

  public safePop(): StackElement {
    if (this.parent) {
      return this.parent;
    }
    return this;
  }

  public push(
    ruleId: number,
    enterPos: number,
    endRule: string | undefined,
    nameScopesList?: ScopeListElement,
    contentNameScopesList?: ScopeListElement
  ): StackElement {
    nameScopesList = nameScopesList ?? this.nameScopesList;
    contentNameScopesList = contentNameScopesList ?? this.contentNameScopesList;
    return new StackElement(this, ruleId, enterPos, endRule, nameScopesList, contentNameScopesList);
  }

  public getEnterPos(): number {
    return this._enterPos;
  }

  public getRule(grammar: IRuleRegistry): Rule {
    return grammar.getRule(this.ruleId);
  }

  private _writeString(res: string[], outIndex: number): number {
    if (this.parent) {
      outIndex = this.parent._writeString(res, outIndex);
    }

    res[outIndex++] = `(${this.ruleId}, TODO-${this.nameScopesList}, TODO-${this.contentNameScopesList})`;

    return outIndex;
  }

  public toString(): string {
    const r: string[] = [];
    this._writeString(r, 0);
    return '[' + r.join(',') + ']';
  }

  public setContentNameScopesList(contentNameScopesList: ScopeListElement): StackElement {
    if (this.contentNameScopesList === contentNameScopesList) {
      return this;
    }
    return this.parent!.push(this.ruleId, this._enterPos, this.endRule, this.nameScopesList, contentNameScopesList);
  }

  public setEndRule(endRule: string): StackElement {
    if (this.endRule === endRule) {
      return this;
    }
    return new StackElement(
      this.parent,
      this.ruleId,
      this._enterPos,
      endRule,
      this.nameScopesList,
      this.contentNameScopesList
    );
  }

  public hasSameRuleAs(other: StackElement): boolean {
    return this.ruleId === other.ruleId;
  }
}

export class LocalStackElement {
  constructor(public readonly scopes: ScopeListElement, public readonly endPos: number) {}
}

interface TokenTypeMatcher {
  readonly matcher: Matcher<string[]>;
  readonly type: StandardTokenType;
}

class LineTokens {
  private readonly _emitBinaryTokens: boolean;
  /**
   * defined only if `IN_DEBUG_MODE`.
   */
  private readonly _lineText: string;
  /**
   * used only if `_emitBinaryTokens` is false.
   */
  private readonly _tokens: IToken[];
  /**
   * used only if `_emitBinaryTokens` is true.
   */
  private readonly _binaryTokens: number[];

  private _lastTokenEndIndex: number;

  private readonly _tokenTypeOverrides: TokenTypeMatcher[];

  constructor(emitBinaryTokens: boolean, lineText: string, tokenTypeOverrides: TokenTypeMatcher[]) {
    this._emitBinaryTokens = emitBinaryTokens;
    this._tokenTypeOverrides = tokenTypeOverrides;
    if (debug.IN_DEBUG_MODE) {
      this._lineText = lineText;
    }
    if (this._emitBinaryTokens) {
      this._binaryTokens = [];
    } else {
      this._tokens = [];
    }
    this._lastTokenEndIndex = 0;
  }

  public produce(stack: StackElement, endIndex: number): void {
    this.produceFromScopes(stack.contentNameScopesList, endIndex);
  }

  public produceFromScopes(scopesList: ScopeListElement, endIndex: number): void {
    if (this._lastTokenEndIndex >= endIndex) {
      return;
    }

    const metadataRecord = scopesList.metadataRecord;

    if (this._emitBinaryTokens) {

      for (const tokenType of this._tokenTypeOverrides) {
        if (tokenType.matcher(scopesList.generateScopes())) {
          metadataRecord.metadata = StackElementMetadata.set(metadataRecord.metadata, 0, toTemporaryType(tokenType.type), FontStyle.NotSet, 0, 0);
        }
      }

      if (this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 1] === metadataRecord.metadata) {
        // no need to push a token with the same metadata
        this._lastTokenEndIndex = endIndex;
        return;
      }

      this._binaryTokens.push(this._lastTokenEndIndex);
      this._binaryTokens.push(metadataRecord.metadata);

      this._lastTokenEndIndex = endIndex;
      return;
    }

    const scopes = scopesList.generateScopes();

    if (debug.IN_DEBUG_MODE) {
      console.log(
        '  token: |' + this._lineText.substring(this._lastTokenEndIndex, endIndex).replace(/\n$/, '\\n') + '|'
      );
      for (let k = 0; k < scopes.length; k++) {
        console.log('      * ' + scopes[k]);
      }
    }

    this._tokens.push({
      startIndex: this._lastTokenEndIndex,
      endIndex: endIndex,
      // value: lineText.substring(lastTokenEndIndex, endIndex),
      scopes: scopes,
      meta: metadataRecord.metadata,
      customized: metadataRecord.customized,
    });

    this._lastTokenEndIndex = endIndex;
  }

  public getResult(stack: StackElement, lineLength: number): IToken[] {
    if (this._tokens.length > 0 && this._tokens[this._tokens.length - 1].startIndex === lineLength - 1) {
      // pop produced token for newline
      this._tokens.pop();
    }

    if (this._tokens.length === 0) {
      this._lastTokenEndIndex = -1;
      this.produce(stack, lineLength);
      this._tokens[this._tokens.length - 1].startIndex = 0;
    }

    return this._tokens;
  }

  public getBinaryResult(stack: StackElement, lineLength: number): Uint32Array {
    if (this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 2] === lineLength - 1) {
      // pop produced token for newline
      this._binaryTokens.pop();
      this._binaryTokens.pop();
    }

    if (this._binaryTokens.length === 0) {
      this._lastTokenEndIndex = -1;
      this.produce(stack, lineLength);
      this._binaryTokens[this._binaryTokens.length - 2] = 0;
    }

    const result = new Uint32Array(this._binaryTokens.length);
    for (let i = 0, len = this._binaryTokens.length; i < len; i++) {
      result[i] = this._binaryTokens[i];
    }

    return result;
  }
}

interface SplitLine{
  text: string,
  lineTerminator: string
}

export class CodeDocument {

  private static splitOnLineTerminator(text: string, separators: string[]):SplitLine[]{
    // kudos to m-query lang parser, thanks for the help
    if (separators.length>0){
      const lines:SplitLine[] = text.split(separators[0]).map((lineText:string) => ({
        text: lineText,
        lineTerminator: separators[0]
      }));

      const otherLineTerminators = separators.slice(1);

      if (otherLineTerminators.length){
        let index =0;
        while (index < lines.length){
          let indexWasExpanded = false;

          for (const lineTerminator of otherLineTerminators){
            const currentSplitLine = lines[index];
            const text = currentSplitLine.text;
            if(text.indexOf(lineTerminator) !== -1){
              indexWasExpanded = true;
              const newSplitLines = text.split(lineTerminator).map((lineText:string) => ({
                text: lineText,
                lineTerminator
              }));
              newSplitLines[newSplitLines.length-1].lineTerminator = currentSplitLine.lineTerminator;
              lines.splice(index, 1, ...newSplitLines);
            }
          }

          if (!indexWasExpanded){
            index+=1;
          }
        }
      }

      lines[lines.length - 1].lineTerminator = "";

      return lines;
    }else{
      return [{text, lineTerminator:''}];
    }
  }

  public readonly lines: SplitLine[];
  /**
   * Accumulated line length
   * @private
   */
  private readonly accLineLength: number[] = [];

  get separators(){
    return this._separators;
  }

  constructor(
    public readonly text: string,
    private _separators: string[] = DEFAULT_SEPARATORS,
    public readonly root?: ASTNode
  ) {

    this.lines = CodeDocument.splitOnLineTerminator(text, this._separators);

    this.lines.forEach((value, i) => {
      if (i === 0) {
        this.accLineLength[i] = 0;
      } else {
        this.accLineLength[i] =
          this.accLineLength[i - 1] +
          this.lines[i - 1].text.length +
          this.lines[i - 1].lineTerminator.length;
      }
    });
  }

  traverse(cb: (node: ASTNode) => any, workingNode?: ASTNode) {
    workingNode = workingNode || this.root;
    if (workingNode) {
      cb(workingNode);
      switch (workingNode.type) {
        case 'BeginEndRule':
          workingNode.beginCaptureChildren?.forEach((one) => {
            this.traverse(cb, one);
          });
          workingNode.endCaptureChildren?.forEach((one) => {
            this.traverse(cb, one);
          });
          break;
        case 'BeginWhileRule':
          workingNode.beginCaptureChildren?.forEach((one) => {
            this.traverse(cb, one);
          });
          workingNode.whileCaptureChildren?.forEach((one) => {
            this.traverse(cb, one);
          });
          break;
        // case "IncludeOnlyRule":
        // case "CaptureRule":
        // case "MatchRule":
      }
      workingNode.children?.forEach((one) => {
        this.traverse(cb, one);
      });
    }
  }
  // todo get node after
  getAheadNodeByOffset(offset: number): ASTNode | undefined {
    let workingNode = this.root;
    let found = false;

    while (workingNode && !found) {
      if (!workingNode.children) {
        found = true;
        break;
      }
      let matchingChildNode: ASTNode | undefined;
      workingNode.children.forEach((one) => {
        if (one.offset <= offset && one.offset + one.length > offset) {
          if (!matchingChildNode) {
            matchingChildNode = one;
          } else {
            matchingChildNode = matchingChildNode.offset < one.offset ? one : matchingChildNode;
          }
        }
      });

      if (!matchingChildNode) break;
      workingNode = matchingChildNode;
    }

    return workingNode;
  }

  getNodeByOffset(offset: number): ASTNode | undefined {
    let workingNode = this.root;
    let found = false;

    while (workingNode && !found) {
      if (!workingNode.children) {
        found = true;
        break;
      }
      let matchedChildNode: ASTNode | undefined;
      workingNode.children.forEach((one) => {
        if (one.offset <= offset && one.offset + one.length >= offset) {
          if (!matchedChildNode) {
            matchedChildNode = one;
          } else {
            matchedChildNode = matchedChildNode.offset < one.offset ? one : matchedChildNode;
          }
        }
      });

      if (!matchedChildNode) break;
      workingNode = matchedChildNode;
    }

    return workingNode;
  }

  getNodeContent(node: ASTNode) {
    return this.text.substring(node.offset, node.offset + node.length);
  }

  /**
   * @param offset
   */
  positionAt(offset: number): Position {
    if ( typeof this.text !== 'string' || this.text.length < offset) {
      throw new CodeDocumentOffsetNotInRange(offset, this.text?.length ?? 0, this._separators);
    }
    let theLine = 0,
      theChar = 0;
    // todo enhance it to binary search?
    this.lines.some((one, index) => {
      const curOffset = this.accLineLen(index)
      if (curOffset + one.text.length + one.lineTerminator.length >= offset) {
        theLine = index;
        theChar = offset - curOffset;
        return true;
      }
      return false;
    });
    return new Position(theLine, theChar);
  }

  /**
   * @param pos
   */
  offsetAt(pos: Position): number {
    if (pos.line < 0 || pos.line >= this.lines.length) {
      throw new CodeDocumentPositionNotInRange(pos, this.text?.length ?? 0, this._separators);
    } else if (pos.character < 0 || pos.character >= this.lines[pos.line].text.length + this.lines[pos.line].lineTerminator.length) {
      const theErr = new CodeDocumentPositionNotInRange(pos, this.text.length ?? 0, this._separators);
      theErr.updateMessage(pos, pos.line, this.lines[pos.line].text.length + this.lines[pos.line].lineTerminator.length, this._separators);
      throw theErr;
    }
    return this.accLineLen(pos.line) + pos.character;
  }

  get lineCount(): number {
    return this.lines.length;
  }

  accLineLen(i: number) {
    if (i > -1 && i < this.accLineLength.length) {
      return this.accLineLength[i];
    }
    return 0;
  }

  printASTNode(pretty?: boolean) {
    if (!this.root) return '';
    return JSON.stringify(
      this.root,
      (key, value) => {
        if (key === 'parent' || key.indexOf('$impostureLangNode') > -1) {
          return undefined;
        }
        return value;
      },
      !!pretty ? 2 : 0
    );
  }
}
