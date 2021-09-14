import {SyncRegistry} from './registry';
import {parseJSONGrammar, parsePLISTGrammar} from './grammarReader';
import {Theme} from './theme';
import {StackElement as StackElementImpl} from './grammar';
import {
  IRawGrammar,
  RegistryOptions,
  IRawTheme,
  IGrammarConfiguration,
  IEmbeddedLanguagesMap,
  ITokenTypeMap,
  IGrammar,
  StackElement,
} from './types';
import debug from './debug';

export * from './types';
export {ValueEventEmitter, ValueUpdateListener} from './ValueEventEmitter';
export {CodeDocument} from './grammar';

const DEFAULT_OPTIONS: RegistryOptions = {
  getGrammarDefinition: (_scopeName: string) => null,
  getInjections: (_scopeName: string) => null,
};

export const INITIAL: StackElement = StackElementImpl.NULL;

/**
 * The registry that will hold all grammars.
 */
export class Registry {
  private readonly _syncRegistry: SyncRegistry;
  private readonly _installationQueue: Map<string, Promise<IGrammar>>;

  constructor(private readonly _locator: RegistryOptions = DEFAULT_OPTIONS) {
    debug.CAPTURE_METADATA = !!_locator.captureMeta;
    debug.IN_DEBUG_MODE = !!_locator.debug;
    this._syncRegistry = new SyncRegistry(Theme.createFromRawTheme(_locator.theme));
    this._installationQueue = new Map();
  }

  /**
   * Change the theme. Once called, no previous `ruleStack` should be used anymore.
   */
  public setTheme(theme: IRawTheme): void {
    this._syncRegistry.setTheme(Theme.createFromRawTheme(theme));
  }

  /**
   * Returns a lookup array for color ids.
   */
  public getColorMap(): string[] {
    return this._syncRegistry.getColorMap();
  }

  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   * Please do not use language id 0.
   */
  public loadGrammarWithEmbeddedLanguages(
    initialScopeName: string,
    initialLanguage: number,
    embeddedLanguages: IEmbeddedLanguagesMap
  ): Promise<IGrammar> {
    return this.loadGrammarWithConfiguration(initialScopeName, initialLanguage, {embeddedLanguages});
  }

  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   * Please do not use language id 0.
   */
  public async loadGrammarWithConfiguration(
    initialScopeName: string,
    initialLanguage: number,
    configuration: IGrammarConfiguration
  ): Promise<IGrammar> {
    await this._loadGrammar(initialScopeName);
    return this.grammarForScopeName(
      initialScopeName,
      initialLanguage,
      configuration.embeddedLanguages,
      configuration.tokenTypes
    );
  }

  /**
   * Get the grammar for `scopeName`. The grammar must first be created via `loadGrammar` or `loadGrammarFromPathSync`.
   */
  public grammarForScopeName(
    scopeName: string,
    initialLanguage = 0,
    embeddedLanguages: IEmbeddedLanguagesMap = null,
    tokenTypes: ITokenTypeMap = null
  ): IGrammar {
    return this._syncRegistry.grammarForScopeName(scopeName, initialLanguage, embeddedLanguages, tokenTypes);
  }

  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   */
  public async loadGrammar(initialScopeName: string): Promise<IGrammar> {
    return this._loadGrammar(initialScopeName);
  }

  private async _loadGrammar(initialScopeName: string, dependentScope: string = null): Promise<IGrammar> {
    // already installed
    if (this._syncRegistry.lookup(initialScopeName)) {
      return this.grammarForScopeName(initialScopeName);
    }
    // installation in progress
    if (this._installationQueue.has(initialScopeName)) {
      return this._installationQueue.get(initialScopeName);
    }
    // start installation process
    const prom = new Promise<IGrammar>(async (resolve, _reject) => {
      const grammarDefinition = await this._locator.getGrammarDefinition(initialScopeName, dependentScope);
      if (!grammarDefinition) {
        throw new Error(`A tmGrammar load was requested but registry host failed to provide grammar definition`);
      }
      if (
        (grammarDefinition.format !== 'json' && grammarDefinition.format !== 'plist') ||
        (grammarDefinition.format === 'json' &&
          typeof grammarDefinition.content !== 'object' &&
          typeof grammarDefinition.content !== 'string') ||
        (grammarDefinition.format === 'plist' && typeof grammarDefinition.content !== 'string')
      ) {
        throw new TypeError(
          'Grammar definition must be an object, either `{ content: string | object, format: "json" }` OR `{ content: string, format: "plist" }`)'
        );
      }
      const rawGrammar: IRawGrammar =
        grammarDefinition.format === 'json'
          ? typeof grammarDefinition.content === 'string'
            ? parseJSONGrammar(grammarDefinition.content, `/dummy/path/${initialScopeName}`)
            : (grammarDefinition.content as IRawGrammar)
          : parsePLISTGrammar(grammarDefinition.content as string, `c://dummy/path/${initialScopeName}.plist`);
      const injections =
        typeof this._locator.getInjections === 'function' && this._locator.getInjections(initialScopeName);

      (rawGrammar as any).scopeName = initialScopeName;
      const deps = this._syncRegistry.addGrammar(rawGrammar, injections);
      await Promise.all(
        deps.map(async (scopeNameD) => {
          try {
            return this._loadGrammar(scopeNameD, initialScopeName);
          } catch (error) {
            throw new Error(
              `While trying to load tmGrammar with scopeId: '${initialScopeName}', it's dependency (scopeId: ${scopeNameD}) loading errored: ${error.message}`
            );
          }
        })
      );
      resolve(this.grammarForScopeName(initialScopeName));
    });
    this._installationQueue.set(initialScopeName, prom);
    prom.then(() => {
      this._installationQueue.delete(initialScopeName);
    });
    return prom;
  }
}
