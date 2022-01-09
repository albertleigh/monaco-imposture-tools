import {IScopeNameSet, IThemeProvider, IGrammarRepository} from './common';
import {createGrammar, Grammar, collectIncludedScopes} from './grammar';
import {IRawGrammar} from './types';
import {IGrammar, IEmbeddedLanguagesMap, ITokenTypeMap} from './main';
import {Theme, ThemeTrieElementRule} from './theme';

export class SyncRegistry implements IGrammarRepository, IThemeProvider {
  private readonly _grammars: Record<string, Grammar>;
  private readonly _rawGrammars: Record<string, IRawGrammar>;
  private readonly _injectionGrammars: Record<string, string[]>;

  constructor(private _theme: Theme) {
    this._grammars = {};
    this._rawGrammars = {};
    this._injectionGrammars = {};
  }

  public setTheme(theme: Theme): void {
    this._theme = theme;
    Object.keys(this._grammars).forEach((scopeName) => {
      const grammar = this._grammars[scopeName];
      grammar.onDidChangeTheme();
    });
  }

  public getColorMap(): string[] {
    return this._theme.getColorMap();
  }

  /**
   * Add `grammar` to registry and return a list of referenced scope names
   */
  public addGrammar(grammar: IRawGrammar, injectionScopeNames?: string[]): string[] {
    this._rawGrammars[grammar.scopeName] = grammar;

    const includedScopes: IScopeNameSet = {};
    collectIncludedScopes(includedScopes, grammar);

    if (injectionScopeNames) {
      this._injectionGrammars[grammar.scopeName] = injectionScopeNames;
      injectionScopeNames.forEach((scopeName) => {
        includedScopes[scopeName] = true;
      });
    }
    return Object.keys(includedScopes);
  }

  /**
   * Lookup a raw grammar.
   */
  public lookup(scopeName: string): IRawGrammar {
    return this._rawGrammars[scopeName];
  }

  /**
   * Returns the injections for the given grammar
   */
  public injections(targetScope: string): string[] {
    return this._injectionGrammars[targetScope];
  }

  /**
   * Get the default theme settings
   */
  public getDefaults(): ThemeTrieElementRule {
    return this._theme.getDefaults();
  }

  /**
   * Match a scope in the theme.
   */
  public themeMatch(scopeName: string): ThemeTrieElementRule[] {
    return this._theme.match(scopeName);
  }

  /**
   * Lookup a grammar.
   */
  public grammarForScopeName(
    scopeName: string,
    initialLanguage: number,
    embeddedLanguages: IEmbeddedLanguagesMap | null | undefined,
    tokenTypes: ITokenTypeMap | null | undefined
  ): IGrammar | null {
    if (!this._grammars[scopeName]) {
      const rawGrammar = this._rawGrammars[scopeName];
      if (!rawGrammar) {
        return null;
      }

      this._grammars[scopeName] = createGrammar(rawGrammar, initialLanguage, embeddedLanguages, tokenTypes, this);
    }
    return this._grammars[scopeName];
  }
}
