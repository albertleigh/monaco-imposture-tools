import {ThemeTrieElementRule} from './theme';
import {IRawGrammar, IRawRepository, Position} from './types';
import {Rule} from './rule';
import {OnigScanner} from '@monaco-imposture-tools/oniguruma-asm';

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
  getExternalGrammar(scopeName: string, repository: IRawRepository): IRawGrammar | undefined;
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


// common err clazz

// code documents

export class CodeDocumentOffsetNotInRange extends Error {
  constructor(offset: number, range: number, separator:string) {
    super(`Current offset: ${offset} is out the total length ${range} of the file of separator ${separator}.`);
  }

  updateMessage(pos: Position, lineNum: number, charNum: number, separator:string) {
    this.message = `Current position: L${pos.line} C${pos.character} is out of the total length of L${lineNum} C${charNum} of the file seperated by ${separator}.`;
  }
}

export class CodeDocumentPositionNotInRange extends Error {
  constructor(pos: Position, range: number, separator:string) {
    super(`Current position: L${pos.line} C${pos.character} is out of the total length ${range} of the file of separator ${separator}.`);
  }

  updateMessage(pos: Position, lineNum: number, charNum: number, separator:string) {
    this.message = `Current position: L${pos.line} C${pos.character} is out of the total length of L${lineNum} C${charNum} of the file seperated by ${separator}.`;
  }
}
