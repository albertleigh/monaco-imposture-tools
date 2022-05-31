import {SyncRegistry} from './registry';
import {parseJSONGrammar} from './grammarReader';
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
export * from './grammarHelper'

const DEFAULT_OPTIONS: RegistryOptions = {
  getGrammarDefinition: ((_scopeName: string) => undefined) as any,
  getInjections: (_scopeName: string) => [],
};

export const INITIAL: StackElement = StackElementImpl.NULL;

/**
 * The registry that will hold all grammars.
 */
export class Registry {
  private readonly _syncRegistry: SyncRegistry;
  private readonly _installationQueue: Map<string, Promise<IGrammar | undefined>>;

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
  ): Promise<IGrammar|undefined> {
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
  ): Promise<IGrammar|undefined> {
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
    embeddedLanguages: IEmbeddedLanguagesMap | undefined = undefined,
    tokenTypes: ITokenTypeMap | undefined = undefined
  ): IGrammar | undefined {
    return this._syncRegistry.grammarForScopeName(scopeName, initialLanguage, embeddedLanguages, tokenTypes);
  }

  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   */
  public loadGrammar(initialScopeName: string): Promise<IGrammar | undefined> {
    return this._loadGrammar(initialScopeName);
  }

  /**
   * do load grammar
   * @param initialScopeName    the grammar's scope name to load
   * @param dependentScope      the scope name of the grammar demanding
   * @private
   */
  private async _loadGrammar(initialScopeName: string, dependentScope: string | null | undefined = null): Promise<IGrammar | undefined> {
    // already installed
    if (this._syncRegistry.lookup(initialScopeName)) {
      return this.grammarForScopeName(initialScopeName);
    }
    // installation in progress
    if (this._installationQueue.has(initialScopeName)) {
      return this._installationQueue.get(initialScopeName)!;
    }
    // start installation process
    const prom = new Promise<IGrammar | undefined>(async (resolve, _reject) => {
      const grammarDefinition = await this._locator.getGrammarDefinition(initialScopeName, dependentScope);
      if (!grammarDefinition) {
        // todo enhance this error message
        throw new Error(`A tmGrammar load was requested but registry host failed to provide grammar definition`);
      }
      if (
        (grammarDefinition.format !== 'json') ||
        (grammarDefinition.format === 'json' &&
          typeof grammarDefinition.content !== 'object' &&
          typeof grammarDefinition.content !== 'string')
      ) {
        throw new TypeError(
          'Grammar definition must be an object, either `{ content: string | object, format: "json" }`'
        );
      }
      // for now, we currently support json
      const rawGrammar: IRawGrammar =
        typeof grammarDefinition.content === 'string'
          ? parseJSONGrammar(grammarDefinition.content, `in-memory://${initialScopeName}`)
          : (grammarDefinition.content as IRawGrammar)
      const injections =
        typeof this._locator.getInjections === 'function' ? this._locator.getInjections(initialScopeName) : undefined;

      (rawGrammar as any).scopeName = initialScopeName;
      const deps = this._syncRegistry.addGrammar(rawGrammar, injections);
      await Promise.all(
        deps.map(async (oneDepScopeName) => {
          try {
            return this._loadGrammar(oneDepScopeName, initialScopeName);
          } catch (error) {
            throw new Error(
              `While trying to load tmGrammar with scopeId: '${initialScopeName}', it's dependency (scopeId: ${oneDepScopeName}) loading errored: ${error.message}`
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
