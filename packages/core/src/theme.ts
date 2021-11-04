import {FontStyle} from './common';
import {IRawTheme} from './types';

export class ParsedThemeRule {
  constructor(
    public readonly scope: string,
    public readonly parentScopes: string[],
    public readonly index: number,
    /**
     * -1 if not set. An or mask of `FontStyle` otherwise.
     */
    public readonly fontStyle: number,
    public readonly foreground: string,
    public readonly background: string
  ) {}
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
 * Parse a raw theme into rules.
 */
export function parseTheme(source: IRawTheme): ParsedThemeRule[] {
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
        }
      }
    }

    let foreground: string = null;
    if (typeof entry.settings.foreground === 'string' && isValidHexColor(entry.settings.foreground)) {
      foreground = entry.settings.foreground;
    }

    let background: string = null;
    if (typeof entry.settings.background === 'string' && isValidHexColor(entry.settings.background)) {
      background = entry.settings.background;
    }

    for (let j = 0, lenJ = scopes.length; j < lenJ; j++) {
      const _scope = scopes[j].trim();

      const segments = _scope.split(' ');

      const scope = segments[segments.length - 1];
      let parentScopes: string[] = null;
      if (segments.length > 1) {
        parentScopes = segments.slice(0, segments.length - 1);
        parentScopes.reverse();
      }

      result[resultLen++] = new ParsedThemeRule(scope, parentScopes, i, fontStyle, foreground, background);
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
  while (parsedThemeRules.length >= 1 && parsedThemeRules[0].scope === '') {
    const incomingDefaults = parsedThemeRules.shift();
    if (incomingDefaults.fontStyle !== FontStyle.NotSet) {
      defaultFontStyle = incomingDefaults.fontStyle;
    }
    if (incomingDefaults.foreground !== null) {
      defaultForeground = incomingDefaults.foreground;
    }
    if (incomingDefaults.background !== null) {
      defaultBackground = incomingDefaults.background;
    }
  }
  const colorMap = new ColorMap();
  const defaults = new ThemeTrieElementRule(
    0,
    null,
    defaultFontStyle,
    colorMap.getId(defaultForeground),
    colorMap.getId(defaultBackground)
  );

  const root = new ThemeTrieElement(new ThemeTrieElementRule(0, null, FontStyle.NotSet, 0, 0), []);
  for (let i = 0, len = parsedThemeRules.length; i < len; i++) {
    const rule = parsedThemeRules[i];
    root.insert(
      0,
      rule.scope,
      rule.parentScopes,
      rule.fontStyle,
      colorMap.getId(rule.foreground),
      colorMap.getId(rule.background)
    );
  }

  return new Theme(colorMap, defaults, root);
}

export class ColorMap {
  private _lastColorId: number;
  private readonly _id2color: string[];
  private readonly _color2id: {[color: string]: number};

  constructor() {
    this._lastColorId = 0;
    this._id2color = [];
    this._color2id = Object.create(null);
  }

  public getId(color: string): number {
    if (color === null) {
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

export class Theme {
  public static createFromRawTheme(source: IRawTheme): Theme {
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

export function strArrCmp(a: string[], b: string[]): number {
  if (a === null && b === null) {
    return 0;
  }
  if (!a) {
    return -1;
  }
  if (!b) {
    return 1;
  }
  const len1 = a.length;
  const len2 = b.length;
  if (len1 === len2) {
    for (let i = 0; i < len1; i++) {
      const res = strcmp(a[i], b[i]);
      if (res !== 0) {
        return res;
      }
    }
    return 0;
  }
  return len1 - len2;
}

export class ThemeTrieElementRule {
  constructor(
    public scopeDepth: number,
    public parentScopes: string[],
    public fontStyle: number,
    public foreground: number,
    public background: number
  ) {}

  public clone(): ThemeTrieElementRule {
    return new ThemeTrieElementRule(
      this.scopeDepth,
      this.parentScopes,
      this.fontStyle,
      this.foreground,
      this.background
    );
  }

  public static cloneArr(arr: ThemeTrieElementRule[]): ThemeTrieElementRule[] {
    const r: ThemeTrieElementRule[] = [];
    for (let i = 0, len = arr.length; i < len; i++) {
      r[i] = arr[i].clone();
    }
    return r;
  }

  public acceptOverwrite(scopeDepth: number, fontStyle: number, foreground: number, background: number): void {
    if (this.scopeDepth > scopeDepth) {
      console.log('how did this happen?');
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
  }
}

export class ThemeTrieElement {
  constructor(
    private readonly _mainRule: ThemeTrieElementRule,
    private readonly _rulesWithParentScopes: ThemeTrieElementRule[] = [],
    private readonly _children: Record<string, ThemeTrieElement> = {}
  ) {}

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
      const aParentScopesLen = aParentScopes === null ? 0 : aParentScopes.length;
      const bParentScopesLen = bParentScopes === null ? 0 : bParentScopes.length;
      if (aParentScopesLen === bParentScopesLen) {
        for (let i = 0; i < aParentScopesLen; i++) {
          const aLen = aParentScopes[i].length;
          const bLen = bParentScopes[i].length;
          if (aLen !== bLen) {
            return bLen - aLen;
          }
        }
      }
      return bParentScopesLen - aParentScopesLen;
    }
    return b.scopeDepth - a.scopeDepth;
  }

  public match(scope: string): ThemeTrieElementRule[] {
    if (scope === '') {
      return ThemeTrieElement._sortBySpecificity([].concat(this._mainRule).concat(this._rulesWithParentScopes));
    }

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

    if (this._children.hasOwnProperty(head)) {
      return this._children[head].match(tail);
    }

    return ThemeTrieElement._sortBySpecificity([].concat(this._mainRule).concat(this._rulesWithParentScopes));
  }

  public insert(
    scopeDepth: number,
    scope: string,
    parentScopes: string[],
    fontStyle: number,
    foreground: number,
    background: number
  ): void {
    if (scope === '') {
      this._doInsertHere(scopeDepth, parentScopes, fontStyle, foreground, background);
      return;
    }

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

    let child: ThemeTrieElement;
    if (this._children.hasOwnProperty(head)) {
      child = this._children[head];
    } else {
      child = new ThemeTrieElement(this._mainRule.clone(), ThemeTrieElementRule.cloneArr(this._rulesWithParentScopes));
      this._children[head] = child;
    }

    child.insert(scopeDepth + 1, tail, parentScopes, fontStyle, foreground, background);
  }

  private _doInsertHere(
    scopeDepth: number,
    parentScopes: string[],
    fontStyle: number,
    foreground: number,
    background: number
  ): void {
    if (parentScopes === null) {
      // Merge into the main rule
      this._mainRule.acceptOverwrite(scopeDepth, fontStyle, foreground, background);
      return;
    }

    // Try to merge into existing rule
    for (let i = 0, len = this._rulesWithParentScopes.length; i < len; i++) {
      const rule = this._rulesWithParentScopes[i];

      if (strArrCmp(rule.parentScopes, parentScopes) === 0) {
        // bingo! => we get to merge this into an existing one
        rule.acceptOverwrite(scopeDepth, fontStyle, foreground, background);
        return;
      }
    }

    // Must add a new rule

    // Inherit from main rule
    if (fontStyle === FontStyle.NotSet) {
      fontStyle = this._mainRule.fontStyle;
    }
    if (foreground === 0) {
      foreground = this._mainRule.foreground;
    }
    if (background === 0) {
      background = this._mainRule.background;
    }

    this._rulesWithParentScopes.push(
      new ThemeTrieElementRule(scopeDepth, parentScopes, fontStyle, foreground, background)
    );
  }
}