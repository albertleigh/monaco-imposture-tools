import {IRuleRegistry, IRuleFactoryHelper, ICompiledRule, ICompilePatternsResult} from './common';
import {RegexSource, mergeObjects, escapeRegExpCharacters} from './utils';
import {ImpostureLang, IRawGrammar, IRawRepository, IRawRule, IRawCaptures} from './types';
import {OnigScanner, IOnigCaptureIndex} from '@monaco-imposture-tools/oniguruma-asm';

const HAS_BACK_REFERENCES = /\\(\d+)/;
const BACK_REFERENCING_END = /\\(\d+)/g;

export abstract class Rule {
  private readonly _nameIsCapturing: boolean;

  private readonly _contentNameIsCapturing: boolean;

  protected constructor(
    public readonly $impostureLang: ImpostureLang,
    public readonly id: number,
    public readonly _name: string | undefined,
    public readonly _contentName: string | undefined
  ) {
    // todo do we really not want _name/_contentName to become "", thus cannot use _name ?? undefined here
    this._name = _name || undefined;
    this._contentName = _contentName || undefined;
    this._nameIsCapturing = RegexSource.hasCaptures(this._name);
    this._contentNameIsCapturing = RegexSource.hasCaptures(this._contentName);
  }

  public get debugName(): string {
    return `${(<any>this.constructor).name}#${this.id} @ ${this.$impostureLang?.dataType}`;
  }

  public getName(lineText: string| undefined, captureIndices: IOnigCaptureIndex[] | undefined): string | undefined {
    if (!this._nameIsCapturing) {
      return this._name;
    }
    return RegexSource.replaceCaptures(this._name!, lineText!, captureIndices!);
  }

  public getContentName(lineText: string, captureIndices: IOnigCaptureIndex[]): string | undefined {
    if (!this._contentNameIsCapturing) {
      return this._contentName;
    }
    return RegexSource.replaceCaptures(this._contentName!, lineText, captureIndices);
  }

  /**
   * Collect sub-rules into output RegExpSourceList
   * @param grammar       the rule registry
   * @param out           the output collector RegExpSourceList
   * @param isFirst       collected rule content for the first time
   *    for the first time:
   *      it would only collect the content of the rule
   *    for the non-first time:
   *      it would collect the entry part of the rule and only compile the condition of the rule,
   *      like begin for the BeginEndRule
   *
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public collectPatternsRecursive(grammar: IRuleRegistry, out: RegExpSourceList, isFirst: boolean) {
    throw new Error('Implement me!');
  }

  /**
   * Compile current rule
   * @param grammar           the rule registry
   * @param endRegexSource
   * @param allowA
   * @param allowG
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public compile(grammar: IRuleRegistry, endRegexSource: string | undefined, allowA: boolean, allowG: boolean): ICompiledRule {
    throw new Error('Implement me!');
  }
}

export class CaptureRule extends Rule {
  /**
   * Constructor of a capture rule
   * @param $impostureLang
   * @param id
   * @param name
   * @param contentName
   * @param retokenizeCapturedWithRuleId the rule id of the inner pattern rule within the capture rule if exists, or ruld id 0 if not
   */
  constructor(
    $impostureLang: ImpostureLang,
    id: number,
    name: string | undefined,
    contentName: string | undefined,
    public readonly retokenizeCapturedWithRuleId: number
  ) {
    super($impostureLang, id, name, contentName);
  }
}

interface IRegExpSourceAnchorCache {
  readonly A0_G0: string;
  readonly A0_G1: string;
  readonly A1_G0: string;
  readonly A1_G1: string;
}

/**
 * Regular expression resource for a rule
 * who would help to handle BackReference and anchors
 */
export class RegExpSource {
  public source: string;
  public readonly ruleId: number;
  public hasAnchor: boolean;
  public readonly hasBackReferences: boolean;
  private _anchorCache: IRegExpSourceAnchorCache;

  constructor(regExpSource: string, ruleId: number, handleAnchors = true) {
    if (handleAnchors) {
      this._handleAnchors(regExpSource);
    } else {
      this.source = regExpSource;
      this.hasAnchor = false;
    }

    if (this.hasAnchor) {
      this._anchorCache = this._buildAnchorCache();
    }

    this.ruleId = ruleId;
    this.hasBackReferences = HAS_BACK_REFERENCES.test(this.source);
  }

  public clone(): RegExpSource {
    return new RegExpSource(this.source, this.ruleId, true);
  }

  public setSource(newSource: string): void {
    if (this.source === newSource) {
      return;
    }
    this.source = newSource;

    if (this.hasAnchor) {
      this._anchorCache = this._buildAnchorCache();
    }
  }

  private _handleAnchors(regExpSource: string): void {
    if (regExpSource) {
      let pos: number,
        len: number,
        ch: string,
        nextCh: string,
        lastPushedPos = 0;
      const output: string[] = [];

      let hasAnchor = false;
      for (pos = 0, len = regExpSource.length; pos < len; pos++) {
        ch = regExpSource.charAt(pos);

        if (ch === '\\') {
          if (pos + 1 < len) {
            nextCh = regExpSource.charAt(pos + 1);
            if (nextCh === 'z') {
              output.push(regExpSource.substring(lastPushedPos, pos));
              output.push('$(?!\\n)(?<!\\n)');
              lastPushedPos = pos + 2;
            } else if (nextCh === 'A' || nextCh === 'G') {
              hasAnchor = true;
            }
            pos++;
          }
        }
      }

      this.hasAnchor = hasAnchor;
      if (lastPushedPos === 0) {
        // No \z hit
        this.source = regExpSource;
      } else {
        output.push(regExpSource.substring(lastPushedPos, len));
        this.source = output.join('');
      }
    } else {
      this.hasAnchor = false;
      this.source = regExpSource;
    }
  }

  public resolveBackReferences(lineText: string, captureIndices: IOnigCaptureIndex[]): string {
    const capturedValues = captureIndices.map((capture) => {
      return lineText.substring(capture.start, capture.end);
    });
    BACK_REFERENCING_END.lastIndex = 0;
    return this.source.replace(BACK_REFERENCING_END, (match, g1) => {
      return escapeRegExpCharacters(capturedValues[parseInt(g1, 10)] || '');
    });
  }

  private _buildAnchorCache(): IRegExpSourceAnchorCache {
    const A0_G0_result: string[] = [];
    const A0_G1_result: string[] = [];
    const A1_G0_result: string[] = [];
    const A1_G1_result: string[] = [];

    let pos: number, len: number, ch: string, nextCh: string;

    for (pos = 0, len = this.source.length; pos < len; pos++) {
      ch = this.source.charAt(pos);
      A0_G0_result[pos] = ch;
      A0_G1_result[pos] = ch;
      A1_G0_result[pos] = ch;
      A1_G1_result[pos] = ch;

      if (ch === '\\') {
        if (pos + 1 < len) {
          nextCh = this.source.charAt(pos + 1);
          if (nextCh === 'A') {
            A0_G0_result[pos + 1] = '\uFFFF';
            A0_G1_result[pos + 1] = '\uFFFF';
            A1_G0_result[pos + 1] = 'A';
            A1_G1_result[pos + 1] = 'A';
          } else if (nextCh === 'G') {
            A0_G0_result[pos + 1] = '\uFFFF';
            A0_G1_result[pos + 1] = 'G';
            A1_G0_result[pos + 1] = '\uFFFF';
            A1_G1_result[pos + 1] = 'G';
          } else {
            A0_G0_result[pos + 1] = nextCh;
            A0_G1_result[pos + 1] = nextCh;
            A1_G0_result[pos + 1] = nextCh;
            A1_G1_result[pos + 1] = nextCh;
          }
          pos++;
        }
      }
    }

    return {
      A0_G0: A0_G0_result.join(''),
      A0_G1: A0_G1_result.join(''),
      A1_G0: A1_G0_result.join(''),
      A1_G1: A1_G1_result.join(''),
    };
  }

  public resolveAnchors(allowA: boolean, allowG: boolean): string {
    if (!this.hasAnchor) {
      return this.source;
    }

    if (allowA) {
      if (allowG) {
        return this._anchorCache.A1_G1;
      } else {
        return this._anchorCache.A1_G0;
      }
    } else {
      if (allowG) {
        return this._anchorCache.A0_G1;
      } else {
        return this._anchorCache.A0_G0;
      }
    }
  }
}

interface IRegExpSourceListAnchorCache {
  A0_G0?: ICompiledRule;
  A0_G1?: ICompiledRule;
  A1_G0?: ICompiledRule;
  A1_G1?: ICompiledRule;
}

function createOnigScanner(sources: string[]): OnigScanner {
  return new OnigScanner(sources);
}

/**
 * A list of RegExpSource, namely a wrapper of ICompiledRule
 *    who helps create scanner and handle anchors
 */
export class RegExpSourceList {
  private readonly _items: RegExpSource[];
  private _hasAnchors: boolean;
  private _cached: ICompiledRule | undefined;
  private _anchorCache: IRegExpSourceListAnchorCache;

  constructor() {
    this._items = [];
    this._hasAnchors = false;
    this._cached = undefined;
    this._anchorCache = {
      A0_G0: undefined,
      A0_G1: undefined,
      A1_G0: undefined,
      A1_G1: undefined,
    };
  }

  public push(item: RegExpSource): void {
    this._items.push(item);
    this._hasAnchors = this._hasAnchors || item.hasAnchor;
  }

  public unshift(item: RegExpSource): void {
    this._items.unshift(item);
    this._hasAnchors = this._hasAnchors || item.hasAnchor;
  }

  public length(): number {
    return this._items.length;
  }

  public setSource(index: number, newSource: string): void {
    if (this._items[index].source !== newSource) {
      // bust the cache
      this._cached = undefined;
      this._anchorCache.A0_G0 = undefined;
      this._anchorCache.A0_G1 = undefined;
      this._anchorCache.A1_G0 = undefined;
      this._anchorCache.A1_G1 = undefined;
      this._items[index].setSource(newSource);
    }
  }

  public compile(grammar: IRuleRegistry, allowA: boolean, allowG: boolean): ICompiledRule {
    if (!this._hasAnchors) {
      if (!this._cached) {
        const regExps = this._items.map((e) => e.source);
        this._cached = {
          scanner: createOnigScanner(regExps),
          rules: this._items.map((e) => e.ruleId),
          debugRegExps: regExps,
        };
      }
      return this._cached;
    } else {
      this._anchorCache = {
        A0_G0:
          this._anchorCache.A0_G0 ??
          (!allowA && !allowG ? this._resolveAnchors(allowA, allowG) : undefined),
        A0_G1:
          this._anchorCache.A0_G1 ??
          (!allowA && allowG ? this._resolveAnchors(allowA, allowG) : undefined),
        A1_G0:
          this._anchorCache.A1_G0 ??
          (allowA && !allowG ? this._resolveAnchors(allowA, allowG) : undefined),
        A1_G1:
          this._anchorCache.A1_G1 ?? (allowA && allowG ? this._resolveAnchors(allowA, allowG) : undefined),
      };
      if (allowA) {
        if (allowG) {
          return this._anchorCache.A1_G1!;
        } else {
          return this._anchorCache.A1_G0!;
        }
      } else {
        if (allowG) {
          return this._anchorCache.A0_G1!;
        } else {
          return this._anchorCache.A0_G0!;
        }
      }
    }
  }

  private _resolveAnchors(allowA: boolean, allowG: boolean): ICompiledRule {
    const regExps = this._items.map((e) => e.resolveAnchors(allowA, allowG));
    return {
      scanner: createOnigScanner(regExps),
      rules: this._items.map((e) => e.ruleId),
      debugRegExps: regExps,
    };
  }
}

export class MatchRule extends Rule {
  private readonly _match: RegExpSource;
  public readonly captures: CaptureRule[];
  private _cachedCompiledPatterns?: RegExpSourceList;

  constructor($impostureLang: ImpostureLang, id: number, name: string | undefined, match: string, captures: CaptureRule[]) {
    super($impostureLang, id, name, undefined);
    this._match = new RegExpSource(match, this.id);
    this.captures = captures;
    this._cachedCompiledPatterns = undefined;
  }

  public get debugMatchRegExp(): string {
    return `${this._match.source}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public collectPatternsRecursive(grammar: IRuleRegistry, out: RegExpSourceList, isFirst: boolean) {
    out.push(this._match);
  }

  public compile(grammar: IRuleRegistry, endRegexSource: undefined, allowA: boolean, allowG: boolean): ICompiledRule {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      this.collectPatternsRecursive(grammar, this._cachedCompiledPatterns, true);
    }
    return this._cachedCompiledPatterns.compile(grammar, allowA, allowG);
  }
}

export class IncludeOnlyRule extends Rule {
  public readonly hasMissingPatterns: boolean;
  public readonly patterns: number[];
  private _cachedCompiledPatterns?: RegExpSourceList;

  constructor(
    $impostureLang: ImpostureLang,
    id: number,
    name: string | undefined,
    contentName: string | undefined,
    patterns: ICompilePatternsResult
  ) {
    super($impostureLang, id, name, contentName);
    this.patterns = patterns.patterns;
    this.hasMissingPatterns = patterns.hasMissingPatterns;
    this._cachedCompiledPatterns = undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public collectPatternsRecursive(grammar: IRuleRegistry, out: RegExpSourceList, isFirst: boolean) {
    let i: number, len: number, rule: Rule;

    for (i = 0, len = this.patterns.length; i < len; i++) {
      rule = grammar.getRule(this.patterns[i]);
      rule.collectPatternsRecursive(grammar, out, false);
    }
  }

  public compile(grammar: IRuleRegistry, endRegexSource: undefined, allowA: boolean, allowG: boolean): ICompiledRule {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      this.collectPatternsRecursive(grammar, this._cachedCompiledPatterns, true);
    }
    return this._cachedCompiledPatterns.compile(grammar, allowA, allowG);
  }
}

export class BeginEndRule extends Rule {
  private readonly _begin: RegExpSource;
  public readonly beginCaptures: CaptureRule[];
  private readonly _end: RegExpSource;
  public readonly endHasBackReferences: boolean;
  public readonly endCaptures: CaptureRule[];
  public readonly applyEndPatternLast: boolean;
  public readonly hasMissingPatterns: boolean;
  public readonly patterns: number[];
  private _cachedCompiledPatterns?: RegExpSourceList;

  constructor(
    $impostureLang: ImpostureLang,
    id: number,
    name: string | undefined,
    contentName: string | undefined,
    begin: string,
    beginCaptures: CaptureRule[],
    end: string | undefined,
    endCaptures: CaptureRule[],
    applyEndPatternLast: boolean,
    patterns: ICompilePatternsResult
  ) {
    super($impostureLang, id, name, contentName);
    this._begin = new RegExpSource(begin, this.id);
    this.beginCaptures = beginCaptures;
    // todo should we swap out the end rule if it doesn't exist?
    this._end = new RegExpSource(end ?? '', -1);
    this.endHasBackReferences = this._end.hasBackReferences;
    this.endCaptures = endCaptures;
    this.applyEndPatternLast = applyEndPatternLast ?? false;
    this.patterns = patterns.patterns;
    this.hasMissingPatterns = patterns.hasMissingPatterns;
    this._cachedCompiledPatterns = undefined;
  }

  public get debugBeginRegExp(): string {
    return `${this._begin.source}`;
  }

  public get debugEndRegExp(): string {
    return `${this._end.source}`;
  }

  public getEndWithResolvedBackReferences(lineText: string, captureIndices: IOnigCaptureIndex[]): string {
    return this._end.resolveBackReferences(lineText, captureIndices);
  }

  public collectPatternsRecursive(grammar: IRuleRegistry, out: RegExpSourceList, isFirst: boolean) {
    if (isFirst) {
      let i: number, len: number, rule: Rule;

      for (i = 0, len = this.patterns.length; i < len; i++) {
        rule = grammar.getRule(this.patterns[i]);
        rule.collectPatternsRecursive(grammar, out, false);
      }
    } else {
      out.push(this._begin);
    }
  }

  public compile(grammar: IRuleRegistry, endRegexSource: string, allowA: boolean, allowG: boolean): ICompiledRule {
    const precompiled = this._precompile(grammar);

    if (this._end.hasBackReferences) {
      if (this.applyEndPatternLast) {
        precompiled.setSource(precompiled.length() - 1, endRegexSource);
      } else {
        precompiled.setSource(0, endRegexSource);
      }
    }
    return this._cachedCompiledPatterns!.compile(grammar, allowA, allowG);
  }

  private _precompile(grammar: IRuleRegistry): RegExpSourceList {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();

      this.collectPatternsRecursive(grammar, this._cachedCompiledPatterns, true);

      if (this.applyEndPatternLast) {
        this._cachedCompiledPatterns.push(this._end.hasBackReferences ? this._end.clone() : this._end);
      } else {
        this._cachedCompiledPatterns.unshift(this._end.hasBackReferences ? this._end.clone() : this._end);
      }
    }
    return this._cachedCompiledPatterns;
  }
}

export class BeginWhileRule extends Rule {
  private readonly _begin: RegExpSource;
  public readonly beginCaptures: CaptureRule[];
  private readonly _while: RegExpSource;
  public readonly whileCaptures: CaptureRule[];
  public readonly whileHasBackReferences: boolean;
  public readonly hasMissingPatterns: boolean;
  public readonly patterns: number[];
  private _cachedCompiledPatterns?: RegExpSourceList;
  private _cachedCompiledWhilePatterns?: RegExpSourceList;

  constructor(
    $impostureLang: ImpostureLang,
    id: number,
    name: string | undefined,
    contentName: string | undefined,
    begin: string,
    beginCaptures: CaptureRule[],
    _while: string,
    whileCaptures: CaptureRule[],
    patterns: ICompilePatternsResult
  ) {
    super($impostureLang, id, name, contentName);
    this._begin = new RegExpSource(begin, this.id);
    this.beginCaptures = beginCaptures;
    this._while = new RegExpSource(_while, -2);
    this.whileCaptures = whileCaptures;
    this.whileHasBackReferences = this._while.hasBackReferences;
    this.patterns = patterns.patterns;
    this.hasMissingPatterns = patterns.hasMissingPatterns;
    this._cachedCompiledPatterns = undefined;
    this._cachedCompiledWhilePatterns = undefined;
  }

  public getWhileWithResolvedBackReferences(lineText: string, captureIndices: IOnigCaptureIndex[]): string {
    return this._while.resolveBackReferences(lineText, captureIndices);
  }

  public collectPatternsRecursive(grammar: IRuleRegistry, out: RegExpSourceList, isFirst: boolean) {
    if (isFirst) {
      let i: number, len: number, rule: Rule;

      for (i = 0, len = this.patterns.length; i < len; i++) {
        rule = grammar.getRule(this.patterns[i]);
        rule.collectPatternsRecursive(grammar, out, false);
      }
    } else {
      out.push(this._begin);
    }
  }

  public compile(grammar: IRuleRegistry, endRegexSource: undefined, allowA: boolean, allowG: boolean): ICompiledRule {
    this._precompile(grammar);
    return this._cachedCompiledPatterns!.compile(grammar, allowA, allowG);
  }

  private _precompile(grammar: IRuleRegistry): void {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      this.collectPatternsRecursive(grammar, this._cachedCompiledPatterns, true);
    }
  }

  public compileWhile(grammar: IRuleRegistry, endRegexSource: string, allowA: boolean, allowG: boolean): ICompiledRule {
    this._precompileWhile(grammar);
    if (this._while.hasBackReferences) {
      this._cachedCompiledWhilePatterns!.setSource(0, endRegexSource);
    }
    return this._cachedCompiledWhilePatterns!.compile(grammar, allowA, allowG);
  }

  private _precompileWhile(_grammar: IRuleRegistry): void {
    if (!this._cachedCompiledWhilePatterns) {
      this._cachedCompiledWhilePatterns = new RegExpSourceList();
      this._cachedCompiledWhilePatterns.push(this._while.hasBackReferences ? this._while.clone() : this._while);
    }
  }
}

export class RuleFactory {
  public static createCaptureRule(
    helper: IRuleFactoryHelper,
    $impostureLang: ImpostureLang,
    name: string | undefined,
    contentName: string | undefined,
    retokenizeCapturedWithRuleId: number
  ): CaptureRule {
    return helper.registerRule((id) => {
      return new CaptureRule($impostureLang, id, name, contentName, retokenizeCapturedWithRuleId);
    });
  }

  public static getCompiledRuleId(desc: IRawRule, helper: IRuleFactoryHelper, repository: IRawRepository): number {
    if (!desc.id) {
      helper.registerRule((id) => {
        desc.id = id;
        // match rule
        if (desc.match) {
          return new MatchRule(
            desc.$impostureLang!,
            desc.id,
            desc.name,
            desc.match,
            RuleFactory._compileCaptures(desc.captures, helper, repository)
          );
        }
        // include only
        if (!desc.begin) {
          if (desc.repository) {
            repository = mergeObjects({}, repository, desc.repository);
          }
          return new IncludeOnlyRule(
            desc.$impostureLang!,
            desc.id,
            desc.name,
            desc.contentName,
            RuleFactory._compilePatterns(desc.patterns, helper, repository)
          );
        }
        // while rule
        if (desc.while) {
          return new BeginWhileRule(
            desc.$impostureLang!,
            desc.id,
            desc.name,
            desc.contentName,
            desc.begin,
            RuleFactory._compileCaptures(desc.beginCaptures || desc.captures, helper, repository),
            desc.while,
            RuleFactory._compileCaptures(desc.whileCaptures || desc.captures, helper, repository),
            RuleFactory._compilePatterns(desc.patterns, helper, repository)
          );
        }
        // begin end rule
        return new BeginEndRule(
          desc.$impostureLang!,
          desc.id,
          desc.name,
          desc.contentName,
          desc.begin,
          RuleFactory._compileCaptures(desc.beginCaptures || desc.captures, helper, repository),
          desc.end,
          RuleFactory._compileCaptures(desc.endCaptures || desc.captures, helper, repository),
          !!desc.applyEndPatternLast,
          RuleFactory._compilePatterns(desc.patterns, helper, repository)
        );
      });
    }

    return desc.id!;
  }

  private static _compileCaptures(
    captures: IRawCaptures | undefined,
    helper: IRuleFactoryHelper,
    repository: IRawRepository
  ): CaptureRule[] {
    const r: CaptureRule[] = [];
    let numericCaptureId: number, maximumCaptureId: number, i: number, captureId: string;

    if (captures) {
      // Find the maximum capture id
      maximumCaptureId = 0;
      for (captureId in captures) {
        if (captureId === '$impostureLang') {
          continue;
        }
        numericCaptureId = parseInt(captureId, 10);
        if (numericCaptureId > maximumCaptureId) {
          maximumCaptureId = numericCaptureId;
        }
      }

      // Initialize result
      for (i = 0; i <= maximumCaptureId; i++) {
        (r[i] as any) = undefined;
      }

      // Fill out result
      for (captureId in captures) {
        if (captureId === '$impostureLang') {
          continue;
        }
        numericCaptureId = parseInt(captureId, 10);
        let retokenizeCapturedWithRuleId = 0;
        if (captures[captureId].patterns) {
          retokenizeCapturedWithRuleId = RuleFactory.getCompiledRuleId(captures[captureId], helper, repository);
        }
        r[numericCaptureId] = RuleFactory.createCaptureRule(
          helper,
          captures[captureId].$impostureLang!,
          captures[captureId].name,
          captures[captureId].contentName,
          retokenizeCapturedWithRuleId
        );
      }
    }

    return r;
  }

  private static _compilePatterns(
    patterns: IRawRule[] | null | undefined,
    helper: IRuleFactoryHelper,
    repository: IRawRepository
  ): ICompilePatternsResult {
    const r: number[] = [];
    let pattern: IRawRule,
      i: number,
      len: number,
      patternId: number,
      externalGrammar: IRawGrammar | undefined,
      rule: Rule,
      skipRule: boolean;

    if (patterns) {
      for (i = 0, len = patterns.length; i < len; i++) {
        pattern = patterns[i];
        patternId = -1;

        if (pattern.include) {
          if (pattern.include.charAt(0) === '#') {
            // Local include found in `repository`
            const localIncludedRule = repository[pattern.include.substring(1)];
            if (localIncludedRule) {
              patternId = RuleFactory.getCompiledRuleId(localIncludedRule, helper, repository);
            } else {
              // eslint-disable-next-line no-console
              console.warn('CANNOT find rule for scopeName: ' + pattern.include + ', I am: ', repository['$base'].name);
            }
          } else if (pattern.include === '$base' || pattern.include === '$self') {
            // Special include also found in `repository`
            patternId = RuleFactory.getCompiledRuleId(repository[pattern.include], helper, repository);
          } else {
            // external rule from other tm grammar
            let externalGrammarName: string | undefined = undefined,
              externalGrammarInclude: string | undefined = undefined;
            const sharpIndex = pattern.include.indexOf('#');
            if (sharpIndex >= 0) {
              externalGrammarName = pattern.include.substring(0, sharpIndex);
              externalGrammarInclude = pattern.include.substring(sharpIndex + 1);
            } else {
              externalGrammarName = pattern.include;
            }
            // External include
            externalGrammar = helper.getExternalGrammar(externalGrammarName, repository);

            if (externalGrammar) {
              if (externalGrammarInclude) {
                const externalIncludedRule = externalGrammar.repository[externalGrammarInclude];
                if (externalIncludedRule) {
                  patternId = RuleFactory.getCompiledRuleId(externalIncludedRule, helper, externalGrammar.repository);
                } else {
                  // eslint-disable-next-line no-console
                  console.warn('CANNOT find rule for scopeName: ' + pattern.include + ', I am: ', repository['$base'].name);
                }
              } else {
                patternId = RuleFactory.getCompiledRuleId(
                  externalGrammar.repository.$self,
                  helper,
                  externalGrammar.repository
                );
              }
            } else {
              // eslint-disable-next-line no-console
              console.warn('CANNOT find grammar for scopeName: ' + pattern.include + ', I am: ', repository['$base'].name);
            }
          }
        } else {
          patternId = RuleFactory.getCompiledRuleId(pattern, helper, repository);
        }

        if (patternId !== -1) {
          rule = helper.getRule(patternId);

          skipRule = false;

          if (rule instanceof IncludeOnlyRule || rule instanceof BeginEndRule || rule instanceof BeginWhileRule) {
            if (rule.hasMissingPatterns && rule.patterns.length === 0) {
              skipRule = true;
            }
          }

          if (skipRule) {
            // eslint-disable-next-line no-console
            console.log('REMOVING RULE ENTIRELY DUE TO EMPTY PATTERNS THAT ARE MISSING');
            continue;
          }

          r.push(patternId);
        }
      }
    }

    return {
      patterns: r,
      hasMissingPatterns: (patterns ? patterns.length : 0) !== r.length,
    };
  }
}
