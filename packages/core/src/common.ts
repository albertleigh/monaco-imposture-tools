import {ThemeTrieElementRule} from './theme';
import {IRawGrammar, IRawRepository} from './types';
import {Rule} from './rule';
import {OnigScanner} from '@monaco-imposture-tools/oniguruma-asm';

export const SEPARATOR = '\n';

export const enum FontStyle {
  NotSet = -1,
  None = 0,
  Italic = 1,
  Bold = 2,
  Underline = 4,
}

export interface IScopeNameSet {
  [scopeName: string]: boolean;
}

export interface IThemeProvider {
  themeMatch(scopeName: string): ThemeTrieElementRule[];
  getDefaults(): ThemeTrieElementRule;
}

export interface IGrammarRepository {
  lookup(scopeName: string): IRawGrammar;
  injections(scopeName: string): string[];
}

export interface MatcherWithPriority<T> {
  matcher: Matcher<T>;
  priority: -1 | 0 | 1;
}

export interface Matcher<T> {
  (matcherInput: T): boolean;
}

export interface IRuleRegistry {
  getRule(patternId: number): Rule;
  registerRule<T extends Rule>(factory: (id: number) => T): T;
}

export interface IGrammarRegistry {
  getExternalGrammar(scopeName: string, repository: IRawRepository): IRawGrammar;
}

export interface IRuleFactoryHelper extends IRuleRegistry, IGrammarRegistry {}

export interface ICompiledRule {
  readonly scanner: OnigScanner;
  readonly rules: number[];
  readonly debugRegExps: string[];
}

export interface ICompilePatternsResult {
  readonly patterns: number[];
  readonly hasMissingPatterns: boolean;
}
