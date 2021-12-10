import {
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
  DEFAULT_SEPARATOR,
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
import {IOnigCaptureIndex, OnigString} from '@monaco-imposture-tools/oniguruma-asm';
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
function initGrammar(grammar: IRawGrammar, base: IRawRule): IRawGrammar {
  grammar = clone(grammar);

  grammar.repository = grammar.repository || <any>{};
  grammar.repository.$self = {
    $impostureLang: grammar.$impostureLang,
    patterns: grammar.patterns,
    name: grammar.scopeName,
  };
  grammar.repository.$base = base || grammar.repository.$self;
  return grammar;
}

export function createGrammar(
  grammar: IRawGrammar,
  initialLanguage: number,
  embeddedLanguages: IEmbeddedLanguagesMap,
  tokenTypes: ITokenTypeMap,
  grammarRepository: IGrammarRepository & IThemeProvider
): Grammar {
  return new Grammar(grammar, initialLanguage, embeddedLanguages, tokenTypes, grammarRepository);
}

/**
 * Fill in `result` all external included scopes in `patterns`
 */
function _extractIncludedScopesInPatterns(result: IScopeNameSet, patterns: IRawRule[]): void {
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

function scopesAreMatching(thisScopeName: string, scopeName: string): boolean {
  if (!thisScopeName) {
    return false;
  }
  if (thisScopeName === scopeName) {
    return true;
  }
  const len = scopeName.length;
  return thisScopeName.length > len && thisScopeName.substr(0, len) === scopeName && thisScopeName[len] === '.';
}

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
 * The meta data containing the token type and theme rules of a scope name
 */
export class ScopeMetadata {
  constructor(
    public readonly scopeName: string,
    public readonly languageId: number,
    public readonly tokenType: TemporaryStandardTokenType,
    public readonly themeData: ThemeTrieElementRule[]
  ) {}
}

/**
 * A cache & helper layer for metaData for binary output
 */
class ScopeMetadataProvider {
  private _cache: Record<string, ScopeMetadata>;
  private _defaultMetaData: ScopeMetadata;
  private readonly _embeddedLanguages: IEmbeddedLanguagesMap;
  private readonly _embeddedLanguagesRegex: RegExp;

  constructor(
    private readonly _initialLanguage: number,
    private readonly _themeProvider: IThemeProvider,
    embeddedLanguages: IEmbeddedLanguagesMap
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
        if (typeof language !== 'number' || language === 0) {
          // eslint-disable-next-line no-console
          console.warn('Invalid embedded language found at scope ' + scope + ': <<' + language + '>>');
          // never hurts to be too careful
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
      this._embeddedLanguagesRegex = null;
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
    ]);
  }

  public getDefaultMetadata(): ScopeMetadata {
    return this._defaultMetaData;
  }

  /**
   * Escapes regular expression characters in a given string
   */
  private static _escapeRegExpCharacters(value: string): string {
    return value.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, '\\$&');
  }

  private static _NULL_SCOPE_METADATA = new ScopeMetadata('', 0, 0, null);
  public getMetadataForScope(scopeName: string): ScopeMetadata {
    if (scopeName === null) {
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

    const language = this._embeddedLanguages[m[1]] || 0;
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
    embeddedLanguages: IEmbeddedLanguagesMap,
    tokenTypes: ITokenTypeMap,
    grammarRepository: IGrammarRepository & IThemeProvider
  ) {
    this._scopeMetadataProvider = new ScopeMetadataProvider(initialLanguage, grammarRepository, embeddedLanguages);

    this._rootId = -1;
    this._lastRuleId = 0;
    this._ruleId2desc = [];
    this._includedGrammars = {};
    this._grammarRepository = grammarRepository;
    this._grammar = initGrammar(grammar, null);

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

  public getExternalGrammar(scopeName: string, repository?: IRawRepository): IRawGrammar {
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

  public tokenizeLine(lineText: string, prevState: StackElement): ITokenizeLineResult {
    const r = this._tokenize(lineText, prevState, false);
    return {
      tokens: r.lineTokens.getResult(r.ruleStack, r.lineLength),
      ruleStack: r.ruleStack,
    };
  }

  public tokenizeLine2(lineText: string, prevState: StackElement): ITokenizeLineResult2 {
    const r = this._tokenize(lineText, prevState, true);
    return {
      tokens: r.lineTokens.getBinaryResult(r.ruleStack, r.lineLength),
      ruleStack: r.ruleStack,
    };
  }

  private _tokenize(
    lineText: string,
    prevState: StackElement,
    emitBinaryTokens: boolean
  ): {lineLength: number; lineTokens: LineTokens; ruleStack: StackElement} {
    if (this._rootId === -1) {
      this._rootId = RuleFactory.getCompiledRuleId(this._grammar.repository.$self, this, this._grammar.repository);
    }

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
      // calculate the metadata of the root scope
      const rootScopeName = this.getRule(this._rootId).getName(null, null);
      const rawRootMetadata = this._scopeMetadataProvider.getMetadataForScope(rootScopeName);
      // merge w/ the default metadata
      const rootMetadata = ScopeListElement.mergeMetadata(defaultMetadata, null, rawRootMetadata);

      const scopeList = new ScopeListElement(null, rootScopeName, rootMetadata);

      prevState = new StackElement(null, this._rootId, -1, null, scopeList, scopeList);
    } else {
      isFirstLine = false;
      prevState.reset();
    }

    lineText = lineText + '\n';
    const onigLineText = new OnigString(lineText);
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
    option?: {
      separator?: string;
    }
  ): CodeDocument {
    option = option || {
      separator: DEFAULT_SEPARATOR,
    };

    if (this._rootId === -1) {
      this._rootId = RuleFactory.getCompiledRuleId(this._grammar.repository.$self, this, this._grammar.repository);
    }
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

    const rootRule = this.getRule(this._rootId);
    const rootScopeName = rootRule.getName(null, null);
    const rawRootMetadata = this._scopeMetadataProvider.getMetadataForScope(rootScopeName);
    const rootMetadata = ScopeListElement.mergeMetadata(defaultMetadata, null, rawRootMetadata);

    const scopeList = new ScopeListElement(null, rootScopeName, rootMetadata);

    let prevState = new StackElement(null, this._rootId, -1, null, scopeList, scopeList);
    const textLength = text.length;

    const rootNode = new IncludeOnlyRuleASTNode(
      rootScopeName,
      0,
      textLength,
     )
    rootNode.$impostureLang = rootRule.$impostureLang;

    const codeDocuments = new CodeDocument(text, option.separator, rootNode);
    let workingNode: ASTNode = rootNode;

    codeDocuments.lines.forEach((value, index) => {
      const lineText = value + (index === codeDocuments.lines.length ? '':option.separator);
      const onigText = new OnigString(lineText);
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
  lineText: OnigString,
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
  // the first capture index is the whole match
  const maxEnd = captureIndices[0].end;

  for (let i = 0; i < len; i++) {
    const captureRule = captures[i];
    if (captureRule === null) {
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
      // the capture requires additional matching
      const scopeName = captureRule.getName(lineText.toString(), captureIndices);
      const nameScopesList = stack.contentNameScopesList.push(grammar, scopeName);
      const contentName = captureRule.getContentName(lineText.toString(), captureIndices);
      const contentNameScopesList = nameScopesList.push(grammar, contentName);

      const stackClone = stack.push(
        captureRule.retokenizeCapturedWithRuleId,
        captureIndex.start,
        null,
        nameScopesList,
        contentNameScopesList
      );
      _tokenizeString(
        grammar,
        new OnigString(lineText.substring(0, captureIndex.end)),
        isFirstLine && captureIndex.start === 0,
        captureIndex.start,
        stackClone,
        lineTokens
      );
      continue;
    }

    const captureRuleScopeName = captureRule.getName(lineText.toString(), captureIndices);
    if (captureRuleScopeName !== null) {
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
  lineText: OnigString,
  isFirstLine: boolean,
  linePos: number,
  stack: StackElement,
  anchorPosition: number
): IMatchInjectionsResult {
  // The lower the better
  let bestMatchRating = Number.MAX_VALUE;
  let bestMatchCaptureIndices: IOnigCaptureIndex[] = null;
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
      .compile(grammar, null, isFirstLine, linePos === anchorPosition);
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
      matchedRuleId: bestMatchRuleId,
    };
  }

  return null;
}

interface IMatchResult {
  readonly captureIndices: IOnigCaptureIndex[];
  readonly matchedRuleId: number;
}

function matchRule(
  grammar: Grammar,
  lineText: OnigString,
  isFirstLine: boolean,
  linePos: number,
  stack: StackElement,
  anchorPosition: number
): IMatchResult {
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
  return null;
}

function matchRuleOrInjections(
  grammar: Grammar,
  lineText: OnigString,
  isFirstLine: boolean,
  linePos: number,
  stack: StackElement,
  anchorPosition: number
): IMatchResult {
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
  lineText: OnigString,
  isFirstLine: boolean,
  linePos: number,
  stack: StackElement,
  lineTokens: LineTokens
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
      whileRule.stack.endRule,
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
        // we shouldn't end up here, it must be a whileRule,
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
      stack = whileRule.stack.pop();
      break;
    }
  }

  return {stack: stack, linePos: linePos, anchorPosition: anchorPosition, isFirstLine: isFirstLine};
}

function _tokenizeString(
  grammar: Grammar,
  lineText: OnigString,
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
      console.log('@@scanNext: |' + lineText.toString().replace(/\n$/, '\\n').substr(linePos) + '|');
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

      lineTokens.produce(stack, captureIndices[0].start);

      const beforePush = stack;
      // push it on the stack rule
      const scopeName = _rule.getName(lineText.toString(), captureIndices);
      const nameScopesList = stack.contentNameScopesList.push(grammar, scopeName);
      // populate identical name scope and name content scope and setContentNameScopesList latter if needed
      // like, the contentName is defined on the corresponding rule
      stack = stack.push(matchedRuleId, linePos, null, nameScopesList, nameScopesList);

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
  lineText: OnigString,
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
      whileRule.stack.endRule,
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
        const scopeName = beginWhileRule.getName(lineText.toString(), r.captureIndices);

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
  text: OnigString,
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
    if (captureRule === null) {
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
      const scopeName = captureRule.getName(text.toString(), captureIndices);
      const theOne = new CaptureRuleASTNode(
        scopeName,
        lineOffset + captureIndex.start,
        captureIndex.length,
        parent
      );
      theOne.$impostureLang = captureRule.$impostureLang;
      const stackClone = stack.push(captureRule.retokenizeCapturedWithRuleId, captureIndex.start, null);
      _parseString(
        grammar,
        new OnigString(text.substring(0, captureIndex.end)),
        isFirstLine,
        captureIndex.start,
        lineOffset,
        stackClone,
        theOne
      );
      result.push(theOne);
      continue;
    }

    const captureRuleScopeName = captureRule.getName(text.toString(), captureIndices);
    if (captureRuleScopeName !== null) {
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
  lineText: OnigString,
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
      console.log('@@doParse: |' + lineText.toString().replace(/\n$/, '\\n').substr(linePos) + '|');
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
      workingNode = workingNode.parent;
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
      const scopeName = _rule.getName(lineText.toString(), captureIndices);
      stack = stack.push(matchedRuleId, linePos, null);

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
        anchorPosition = captureIndices[0].end;

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

export class ScopeListElement {
  // _scopeListElementBrand: void;

  constructor(
    public readonly parent: ScopeListElement,
    public readonly scope: string,
    public readonly metadata: number
  ) {}

  private static _equals(a: ScopeListElement, b: ScopeListElement): boolean {
    do {
      if (a === b) {
        return true;
      }

      if (a.scope !== b.scope || a.metadata !== b.metadata) {
        return false;
      }

      // Go to previous pair
      a = a.parent;
      b = b.parent;

      if (!a && !b) {
        // End of list reached for both
        return true;
      }

      if (!a || !b) {
        // End of list reached only for one
        return false;
      }
    } while (true);
  }

  public equals(other: ScopeListElement): boolean {
    return ScopeListElement._equals(this, other);
  }

  private static _matchesScope(scope: string, selector: string, selectorWithDot: string): boolean {
    return selector === scope || scope.substring(0, selectorWithDot.length) === selectorWithDot;
  }

  private static _matches(target: ScopeListElement, parentScopes: string[]): boolean {
    if (parentScopes === null) {
      return true;
    }

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

  public static mergeMetadata(metadata: number, scopesList: ScopeListElement, source: ScopeMetadata): number {
    if (source === null) {
      return metadata;
    }

    let fontStyle = FontStyle.NotSet;
    let foreground = 0;
    let background = 0;

    if (source.themeData !== null) {
      // Find the first themeData that matches
      for (let i = 0, len = source.themeData.length; i < len; i++) {
        const themeData = source.themeData[i];

        if (this._matches(scopesList, themeData.parentScopes)) {
          fontStyle = themeData.fontStyle;
          foreground = themeData.foreground;
          background = themeData.background;
          break;
        }
      }
    }

    return StackElementMetadata.set(metadata, source.languageId, source.tokenType, fontStyle, foreground, background);
  }

  private static _push(target: ScopeListElement, grammar: Grammar, scopes: string[]): ScopeListElement {
    for (let i = 0, len = scopes.length; i < len; i++) {
      const scope = scopes[i];
      const rawMetadata = grammar.getMetadataForScope(scope);
      const metadata = ScopeListElement.mergeMetadata(target.metadata, target, rawMetadata);
      target = new ScopeListElement(target, scope, metadata);
    }
    return target;
  }

  public push(grammar: Grammar, scope: string): ScopeListElement {
    if (scope === null) {
      return this;
    }
    if (scope.indexOf(' ') >= 0) {
      // there are multiple scopes to push
      return ScopeListElement._push(this, grammar, scope.split(/ /g));
    }
    // there is a single scope to push
    return ScopeListElement._push(this, grammar, [scope]);
  }

  private static _generateScopes(scopesList: ScopeListElement): string[] {
    const result: string[] = [];
    let resultLen = 0;
    while (scopesList) {
      result[resultLen++] = scopesList.scope;
      scopesList = scopesList.parent;
    }
    result.reverse();
    return result;
  }

  public generateScopes(): string[] {
    return ScopeListElement._generateScopes(this);
  }
}

/**
 * Represents a "pushed" state on the stack (as a linked list element).
 */
export class StackElement implements StackElementDef {
  _stackElementBrand: void;

  public static NULL = new StackElement(null, 0, 0, null, null, null);

  /**
   * The position on the current line where this state was pushed.
   * This is relevant only while tokenizing a line, to detect endless loops.
   * Its value is meaningless across lines.
   */
  private _enterPos: number;

  /**
   * The previous state on the stack (or null for the root state).
   */
  public readonly parent: StackElement;
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
  public readonly endRule: string;
  /**
   * The list of scopes containing the "name" for this state.
   */
  public readonly nameScopesList: ScopeListElement;
  /**
   * The list of scopes containing the "contentName" (besides "name") for this state.
   * This list **must** contain as an element `scopeName`.
   */
  public readonly contentNameScopesList: ScopeListElement;

  constructor(
    parent: StackElement,
    ruleId: number,
    enterPos: number,
    endRule: string,
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
      a = a.parent;
      b = b.parent;

      if (!a && !b) {
        // End of list reached for both
        return true;
      }

      if (!a || !b) {
        // End of list reached only for one
        return false;
      }
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
    if (other === null) {
      return false;
    }
    return StackElement._equals(this, other);
  }

  private static _reset(el: StackElement): void {
    while (el) {
      el._enterPos = -1;
      el = el.parent;
    }
  }

  public reset(): void {
    StackElement._reset(this);
  }

  public pop(): StackElement {
    return this.parent;
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
    endRule: string,
    nameScopesList?: ScopeListElement,
    contentNameScopesList?: ScopeListElement
  ): StackElement {
    nameScopesList = nameScopesList || this.nameScopesList;
    contentNameScopesList = contentNameScopesList || this.contentNameScopesList;
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
    return this.parent.push(this.ruleId, this._enterPos, this.endRule, this.nameScopesList, contentNameScopesList);
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

    if (this._emitBinaryTokens) {
      let metadata = scopesList.metadata;

      for (const tokenType of this._tokenTypeOverrides) {
        if (tokenType.matcher(scopesList.generateScopes())) {
          metadata = StackElementMetadata.set(metadata, 0, toTemporaryType(tokenType.type), FontStyle.NotSet, 0, 0);
        }
      }

      if (this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 1] === metadata) {
        // no need to push a token with the same metadata
        this._lastTokenEndIndex = endIndex;
        return;
      }

      this._binaryTokens.push(this._lastTokenEndIndex);
      this._binaryTokens.push(metadata);

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

export class CodeDocument {

  static readonly OFFSET_NOT_IN_RANGE = class OffsetNotInRange extends Error {
    constructor(offset: number, range: number) {
      super(`Current offset: ${offset} is out the total length ${range} of the file.`);
    }

    updateMessage(pos: Position, lineNum: number, charNum: number) {
      this.message = `Current position: L${pos.line} C${pos.character} is out of the total length of L${lineNum} C${charNum} of the file.`;
    }
  };

  static readonly POS_NOT_IN_RANGE = class PositionNotInRange extends Error {
    constructor(pos: Position, range: number) {
      super(`Current position: L${pos.line} C${pos.character} is out of the total length ${range} of the file.`);
    }

    updateMessage(pos: Position, lineNum: number, charNum: number) {
      this.message = `Current position: L${pos.line} C${pos.character} is out of the total length of L${lineNum} C${charNum} of the file.`;
    }
  };

  public readonly lines: string[];
  private readonly accLineLength: number[] = [];

  get separator(){
    return this._separator;
  }

  constructor(
    public readonly text: string,
    private _separator: string = DEFAULT_SEPARATOR,
    public readonly root?: ASTNode
  ) {

    this.lines = text.split(_separator);

    this.lines.forEach((value, i) => {
      if (i === 0) {
        this.accLineLength[i] = 0;
      } else {
        this.accLineLength[i] = this.accLineLength[i - 1] + this.lines[i - 1].length + this._separator.length;
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
    return this.text.substr(node.offset, node.length);
  }

  /**
   * @param offset
   */
  positionAt(offset: number): Position {
    if ( typeof this.text !== 'string' || this.text.length < offset) {
      throw new CodeDocument.OFFSET_NOT_IN_RANGE(offset, this.text?.length || 0);
    }
    let theLine = 0,
      theChar = 0,
      curOffset = 0;
    this.lines.some((one, index) => {
      if (curOffset + one.length + 1 > offset) {
        theLine = index;
        theChar = offset - curOffset;
        return true;
      }
      curOffset += one.length + 1;
      return false;
    });
    return new Position(theLine, theChar);
  }

  /**
   * @param pos
   */
  offsetAt(pos: Position): number {
    let result = 0;
    if (pos.line < 0 || pos.line > this.lines.length) {
      throw new CodeDocument.POS_NOT_IN_RANGE(pos, this.text?.length || 0);
    } else if (pos.character < 0 || pos.character > this.lines[pos.line].length) {
      const theErr = new CodeDocument.POS_NOT_IN_RANGE(pos, this.text?.length || 0);
      theErr.updateMessage(pos, pos.line, this.lines[pos.line].length);
      throw theErr;
    }
    this.lines.some((one, index) => {
      if (index === pos.line) {
        result += pos.character;
        return true;
      }
      result += one.length + 1;
      return false;
    });
    return result;
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
