import {FontStyle} from './common';
import {IRawTheme} from './types';

/**
 * Part of monaco ThemeData of the current theme
 */
export interface ITokenThemeRulesAndColors {
  rules: Array<{
    token: string;
    foreground?: string;
    background?: string;
    fontStyle?: string;
  }>
  colors: {
    [colorId: string]: string;
  }
}

/**
 * An initially parsed rule of a scopeList from raw theme
 *  a scope list would be like:
 *    "scope1 scope2 scope3 scope4"
 */
export class ParsedThemeRule {
  constructor(
    /**
     *  scope4 of a scope list: "scope1 scope2 scope3 scope4"
     */
    public readonly scope: string,
    /**
     *  ["scope3", "scope2", "scope1"] of a scope list: "scope1 scope2 scope3 scope4"
     */
    public readonly parentScopes: string[] | undefined,
    public readonly index: number,
    /**
     * -1 if not set. An or mask of `FontStyle` otherwise.
     */
    public readonly fontStyle: number,
    public readonly foreground: string | undefined,
    public readonly background: string | undefined,
    public readonly customized?: Record<string, any>
  ) {
  }
}

function isValidHexColor(hex: string): boolean {
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    // #rrggbb
    return true;
  }

  if (/^#[0-9a-f]{8}$/i.test(hex)) {
    // #rrggbbaa
    return true;
  }

  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    // #rgb
    return true;
  }

  if (/^#[0-9a-f]{4}$/i.test(hex)) {
    // #rgba
    return true;
  }
  return false;
}

/**
 * Parse a raw theme into first-stage ParsedThemeRule.
 */
export function parseTheme(source?: IRawTheme): ParsedThemeRule[] {
  if (!source) {
    return [];
  }
  if (!source.settings || !Array.isArray(source.settings)) {
    return [];
  }
  const settings = source.settings;
  const result: ParsedThemeRule[] = [];
  let resultLen = 0;
  for (let i = 0, len = settings.length; i < len; i++) {
    const entry = settings[i];

    if (!entry.settings) {
      continue;
    }

    let scopes: string[];
    if (typeof entry.scope === 'string') {
      let _scope = entry.scope;

      // remove leading commas
      _scope = _scope.replace(/^[,]+/, '');

      // remove trailing commans
      _scope = _scope.replace(/[,]+$/, '');

      scopes = _scope.split(',');
    } else if (Array.isArray(entry.scope)) {
      scopes = entry.scope;
    } else {
      scopes = [''];
    }

    let fontStyle: number = FontStyle.NotSet;
    if (typeof entry.settings.fontStyle === 'string') {
      fontStyle = FontStyle.None;

      const segments = entry.settings.fontStyle.split(' ');
      for (let j = 0, lenJ = segments.length; j < lenJ; j++) {
        const segment = segments[j];
        switch (segment) {
          case 'italic':
            fontStyle = fontStyle | FontStyle.Italic;
            break;
          case 'bold':
            fontStyle = fontStyle | FontStyle.Bold;
            break;
          case 'underline':
            fontStyle = fontStyle | FontStyle.Underline;
            break;
          case 'strikethrough':
            fontStyle = fontStyle | FontStyle.Strikethrough;
            break;
        }
      }
    }

    let foreground: string | undefined = undefined;
    if (typeof entry.settings.foreground === 'string' && isValidHexColor(entry.settings.foreground)) {
      foreground = entry.settings.foreground;
    }

    let background: string | undefined = undefined;
    if (typeof entry.settings.background === 'string' && isValidHexColor(entry.settings.background)) {
      background = entry.settings.background;
    }

    let customized: Record<string, any> | undefined = undefined;
    if (!!entry.settings.customized && typeof entry.settings.customized === "object") {
      customized = entry.settings.customized;
    }

    for (let j = 0, lenJ = scopes.length; j < lenJ; j++) {
      const _scope = scopes[j].trim();

      const segments = _scope.split(' ');

      const scope = segments[segments.length - 1];
      let parentScopes: string[] | undefined = undefined;
      if (segments.length > 1) {
        parentScopes = segments.slice(0, segments.length - 1);
        parentScopes.reverse();
      }

      result[resultLen++] = new ParsedThemeRule(scope, parentScopes, i, fontStyle, foreground, background, customized);
    }
  }

  return result;
}

/**
 * Resolve rules (i.e. inheritance).
 */
function resolveParsedThemeRules(parsedThemeRules: ParsedThemeRule[]): Theme {
  // Sort rules lexicographically, and then by index if necessary
  parsedThemeRules.sort((a, b) => {
    let r = strcmp(a.scope, b.scope);
    if (r !== 0) {
      return r;
    }
    r = strArrCmp(a.parentScopes, b.parentScopes);
    if (r !== 0) {
      return r;
    }
    return a.index - b.index;
  });

  // Determine defaults
  let defaultFontStyle = FontStyle.None;
  let defaultForeground = '#000000';
  let defaultBackground = '#ffffff';
  let defaultCustomized: Record<string, any> | undefined = undefined;
  while (parsedThemeRules.length >= 1 && parsedThemeRules[0].scope === '') {
    const incomingDefaults = parsedThemeRules.shift()!;
    if (incomingDefaults.fontStyle !== FontStyle.NotSet) {
      defaultFontStyle = incomingDefaults.fontStyle;
    }
    if (!!incomingDefaults.foreground) {
      defaultForeground = incomingDefaults.foreground;
    }
    if (!!incomingDefaults.background) {
      defaultBackground = incomingDefaults.background;
    }
    if (!!incomingDefaults.customized) {
      defaultCustomized = incomingDefaults.customized;
    }
  }
  // set up color map
  const colorMap = new ColorMap();
  // create default tree element rule
  const defaults = new ThemeTrieElementRule(
    0,
    undefined,
    defaultFontStyle,
    colorMap.getId(defaultForeground),
    colorMap.getId(defaultBackground),
    defaultCustomized
  );
  // create tree root element
  const root = new ThemeTrieElement(
    new ThemeTrieElementRule(0, undefined, FontStyle.NotSet, 0, 0),
    []
  );
  // append rules to the tree root
  for (let i = 0, len = parsedThemeRules.length; i < len; i++) {
    const rule = parsedThemeRules[i];
    root.insert(
      0,
      rule.scope,
      rule.parentScopes,
      rule.fontStyle,
      colorMap.getId(rule.foreground),
      colorMap.getId(rule.background),
      rule.customized
    );
  }

  return new Theme(colorMap, defaults, root);
}

export class ColorMap {

  private _lastColorId = 0;
  private readonly _id2color: string[] = [];
  private readonly _color2id: { [color: string]: number } = Object.create(null);

  constructor() {
    // noop
  }

  public getId(color: string | undefined | null): number {
    if (typeof color !== 'string') {
      return 0;
    }
    color = color.toUpperCase();
    let value = this._color2id[color];
    if (value) {
      return value;
    }
    value = ++this._lastColorId;
    this._color2id[color] = value;
    this._id2color[value] = color;
    return value;
  }

  public getColorMap(): string[] {
    return this._id2color.slice(0);
  }
}

/**
 * Theme object supports style tokens
 */
export class Theme {
  public static createFromRawTheme(source?: IRawTheme): Theme {
    return this.createFromParsedTheme(parseTheme(source));
  }

  public static createFromParsedTheme(source: ParsedThemeRule[]): Theme {
    return resolveParsedThemeRules(source);
  }

  private readonly _cache: Record<string, ThemeTrieElementRule[]>;

  constructor(
    private readonly _colorMap: ColorMap,
    private readonly _defaults: ThemeTrieElementRule,
    private readonly _root: ThemeTrieElement
  ) {
    this._cache = {};
  }

  public getColorMap(): string[] {
    return this._colorMap.getColorMap();
  }

  public getDefaults(): ThemeTrieElementRule {
    return this._defaults;
  }

  public getThemeRulesAndColors(): ITokenThemeRulesAndColors {
    const themeRulesAndColors: ITokenThemeRulesAndColors = {
      rules: [],
      colors: {}
    }
    const colorMap = this.getColorMap();
    if (this._defaults.ofThemeValues) {
      themeRulesAndColors.colors['editor.foreground'] = this._defaults.getForegroundValue(colorMap, false) ?? themeRulesAndColors.colors['editor.foreground'];
      themeRulesAndColors.colors['editor.background'] = this._defaults.getBackgroundValue(colorMap, false) ?? themeRulesAndColors.colors['editor.background'];
    }

    this._root.collectThemeRules("", {...themeRulesAndColors, colorMap});

    return themeRulesAndColors;
  }

  /**
   * Find the array of matched rules for the scope name
   * @param scopeName: a string like "segment1.segment2.segment3"
   */
  public match(scopeName: string): ThemeTrieElementRule[] {
    if (!this._cache.hasOwnProperty(scopeName)) {
      this._cache[scopeName] = this._root.match(scopeName);
    }
    return this._cache[scopeName];
  }
}

export function strcmp(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

export function strArrCmp(a: string[] | undefined, b: string[] | undefined): number {
  const hasA = Boolean(a);
  const hasB = Boolean(b);
  if (!hasA && !hasB) {
    return 0;
  }
  if (!hasA) {
    return -1;
  }
  if (!hasB) {
    return 1;
  }
  const len1 = a!.length;
  const len2 = b!.length;
  if (len1 === len2) {
    for (let i = 0; i < len1; i++) {
      const res = strcmp(a![i], b![i]);
      if (res !== 0) {
        return res;
      }
    }
    return 0;
  }
  return len1 - len2;
}

/**
 * Theme tree element's rule holding
 *    parent scopes
 *    current font style
 *    current foreground color
 *    current background color
 *    customized styles record
 */
export class ThemeTrieElementRule {
  constructor(
    public scopeDepth: number,
    public readonly parentScopes: string[] | undefined,
    public fontStyle: number,
    public foreground: number,
    public background: number,
    public customized?: Record<string, any>
  ) {
  }

  public static cloneArr(arr: ThemeTrieElementRule[]): ThemeTrieElementRule[] {
    const r: ThemeTrieElementRule[] = [];
    for (let i = 0, len = arr.length; i < len; i++) {
      r[i] = arr[i].clone();
    }
    return r;
  }

  get ofThemeValues(): boolean {
    return (this.fontStyle !== -1 && this.fontStyle !== 0) ||
      this.foreground > 0 ||
      this.background > 0;
  }

  getFontStyleValue(): string | undefined {
    switch (this.fontStyle) {
      case 4:
        return 'underline';
      case 2:
        return 'bold';
      case 1:
        return 'italic';
      case 0:
      case -1:
      default:
        return undefined;
    }
  }

  getForegroundValue(colorMap: string[], removeSharp = true): string | undefined {
    let theValue = colorMap[this.foreground ?? 0];
    if (theValue) {
      if (removeSharp && theValue.startsWith("#")) {
        theValue = theValue.substring(1);
      }
      return theValue;
    }
    return undefined;
  }

  getBackgroundValue(colorMap: string[], removeSharp = true): string | undefined {
    let theValue = colorMap[this.background ?? 0];
    if (theValue) {
      if (removeSharp && theValue.startsWith("#")) {
        theValue = theValue.substring(1);
      }
      return theValue;
    }
    return undefined;
  }

  public clone(): ThemeTrieElementRule {
    return new ThemeTrieElementRule(
      this.scopeDepth,
      this.parentScopes,
      this.fontStyle,
      this.foreground,
      this.background,
      this.customized
    );
  }

  public acceptOverwrite(scopeDepth: number, fontStyle: number, foreground: number, background: number, customized: Record<string, any> | undefined): void {
    if (this.scopeDepth > scopeDepth) {
      // todo maybe have to log into err
      console.log('[ThemeTrieElementRule::acceptOverwrite] should never reach over here');
    } else {
      this.scopeDepth = scopeDepth;
    }
    // console.log('TODO -> my depth: ' + this.scopeDepth + ', overwriting depth: ' + scopeDepth);
    if (fontStyle !== FontStyle.NotSet) {
      this.fontStyle = fontStyle;
    }
    if (foreground !== 0) {
      this.foreground = foreground;
    }
    if (background !== 0) {
      this.background = background;
    }
    if (!!customized) {
      this.customized = this.customized ? {...this.customized, ...customized} : {...customized};
    }
  }
}

/**
 * Theme tree element contains
 */
export class ThemeTrieElement {
  constructor(
    /**
     * Current rule of the element
     */
    private readonly _mainRule: ThemeTrieElementRule,
    /**
     * Other rules of sharing the same scope name of the element but bear with parent scopes
     */
    private readonly _rulesWithParentScopes: ThemeTrieElementRule[] = [],
    /**
     * Children rules beneath current element
     */
    private readonly _children: Map<string, ThemeTrieElement> = new Map()
  ) {
  }

  private static _sortBySpecificity(arr: ThemeTrieElementRule[]): ThemeTrieElementRule[] {
    if (arr.length === 1) {
      return arr;
    }

    arr.sort(this._cmpBySpecificity);

    return arr;
  }

  private static _cmpBySpecificity(a: ThemeTrieElementRule, b: ThemeTrieElementRule): number {
    if (a.scopeDepth === b.scopeDepth) {
      const aParentScopes = a.parentScopes;
      const bParentScopes = b.parentScopes;
      const aParentScopesLen = !aParentScopes ? 0 : aParentScopes.length;
      const bParentScopesLen = !bParentScopes ? 0 : bParentScopes.length;
      if (aParentScopesLen === bParentScopesLen) {
        for (let i = 0; i < aParentScopesLen; i++) {
          const aLen = aParentScopes![i].length;
          const bLen = bParentScopes![i].length;
          if (aLen !== bLen) {
            return bLen - aLen;
          }
        }
      }
      return bParentScopesLen - aParentScopesLen;
    }
    return b.scopeDepth - a.scopeDepth;
  }

  private getScopeHeadTailPair(scope: string): [string, string] {
    const dotIndex = scope.indexOf('.');
    let head: string;
    let tail: string;
    if (dotIndex === -1) {
      head = scope;
      tail = '';
    } else {
      head = scope.substring(0, dotIndex);
      tail = scope.substring(dotIndex + 1);
    }
    return [head, tail];
  }

  public match(scope: string): ThemeTrieElementRule[] {
    if (scope === '') {
      return ThemeTrieElement._sortBySpecificity(([] as any[]).concat(this._mainRule).concat(this._rulesWithParentScopes));
    }

    const [head, tail] = this.getScopeHeadTailPair(scope);

    if (this._children.has(head)) {
      return this._children.get(head)!.match(tail);
    }

    return ThemeTrieElement._sortBySpecificity(([] as any[]).concat(this._mainRule).concat(this._rulesWithParentScopes));
  }

  public insert(
    scopeDepth: number,
    scope: string,
    parentScopes: string[] | undefined,
    fontStyle: number,
    foreground: number,
    background: number,
    customized?: Record<string, any>
  ): void {
    if (scope === '') {
      this._doInsertHere(scopeDepth, parentScopes, fontStyle, foreground, background, customized);
      return;
    }

    const [head, tail] = this.getScopeHeadTailPair(scope);

    let child: ThemeTrieElement;
    if (this._children.has(head)) {
      child = this._children.get(head)!;
    } else {
      child = new ThemeTrieElement(this._mainRule.clone(), ThemeTrieElementRule.cloneArr(this._rulesWithParentScopes));
      this._children.set(head, child);
    }

    child.insert(scopeDepth + 1, tail, parentScopes, fontStyle, foreground, background, customized);
  }

  private _doInsertHere(
    scopeDepth: number,
    parentScopes: string[] | undefined,
    fontStyle: number,
    foreground: number,
    background: number,
    customized: Record<string, any> | undefined
  ): void {
    if (!parentScopes) {
      // merge into the main rule
      this._mainRule.acceptOverwrite(scopeDepth, fontStyle, foreground, background, customized);
      return;
    }

    // try to merge into existing one rule w/ parent scopes
    for (let i = 0, len = this._rulesWithParentScopes.length; i < len; i++) {
      const rule = this._rulesWithParentScopes[i];

      if (strArrCmp(rule.parentScopes, parentScopes) === 0) {
        // gotcha,  we gonna merge this into an existing one
        rule.acceptOverwrite(scopeDepth, fontStyle, foreground, background, customized);
        return;
      }
    }

    // cannot find an existing rule w/ parent scopes

    // inherit from main rule if unset
    if (fontStyle === FontStyle.NotSet) {
      fontStyle = this._mainRule.fontStyle;
    }
    if (foreground === 0) {
      foreground = this._mainRule.foreground;
    }
    if (background === 0) {
      background = this._mainRule.background;
    }
    if (!customized) {
      customized = this._mainRule.customized;
    }

    this._rulesWithParentScopes.push(
      new ThemeTrieElementRule(scopeDepth, parentScopes, fontStyle, foreground, background, customized)
    );
  }

  public collectThemeRules(currentPath: string, context: ITokenThemeRulesAndColors & { colorMap: string[] }) {
    const hasCurrentPath = !!currentPath;

    if (this._mainRule.ofThemeValues) {
      if (hasCurrentPath) {
        context.rules.push({
          token: currentPath,
          fontStyle: this._mainRule.getFontStyleValue(),
          foreground: this._mainRule.getForegroundValue(context.colorMap),
          background: this._mainRule.getBackgroundValue(context.colorMap),
        })
      } else {
        context.colors['editor.foreground'] = this._mainRule.getForegroundValue(context.colorMap, false) ?? context.colors['editor.foreground'];
        context.colors['editor.background'] = this._mainRule.getBackgroundValue(context.colorMap, false) ?? context.colors['editor.background'];
      }
    }
    for (const [childPath, child] of this._children) {
      child.collectThemeRules(hasCurrentPath ? `${currentPath}.${childPath}` : childPath, context);
    }
  }
}
