import {IRawCaptures, IRawGrammar, IRawRepository, IRawRule, IRawCapturesMap} from './types';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
type IRawRuleRepository = Omit<IRawRepository, '$base' | '$self'>

export function create$impostureLang(type?:string, dataType?:string){
  if (
    typeof type === 'string' && type.length
  ){
    return {
      type,
      dataType: typeof dataType === 'string'? dataType : type
    }
  }
  return undefined;
}

export function createRule(
  name?: string,
  type?: string,
  options?:Partial<{
    readonly $impostureLang: Record<string, any>;
    readonly name?: string;
    readonly contentName?: string;

    readonly match?: string;
    readonly captures?: IRawCaptures;
    readonly begin?: string;
    readonly beginCaptures?: IRawCaptures;
    readonly end?: string;
    readonly endCaptures?: IRawCaptures;
    readonly while?: string;
    readonly whileCaptures?: IRawCaptures;
    readonly patterns?: IRawRule[];

    readonly repository?: IRawRepository;

    readonly applyEndPatternLast?: boolean;
  }>
):IRawRule{
  return {
    name,
    ...options,
    $impostureLang: !!options?.$impostureLang? options.$impostureLang : create$impostureLang(type)
  }
}

export function createTypedRule(
  type?: string,
  options?:Partial<{
    readonly $impostureLang: Record<string, any>;
    readonly name?: string;
    readonly contentName?: string;

    readonly match?: string;
    readonly captures?: IRawCaptures;
    readonly begin?: string;
    readonly beginCaptures?: IRawCaptures;
    readonly end?: string;
    readonly endCaptures?: IRawCaptures;
    readonly while?: string;
    readonly whileCaptures?: IRawCaptures;
    readonly patterns?: IRawRule[];

    readonly repository?: IRawRepository;

    readonly applyEndPatternLast?: boolean;
  }>
):IRawRule{
  return {
    ...options,
    $impostureLang: !!options?.$impostureLang? options.$impostureLang : create$impostureLang(type)
  }
}

export function createInclude(
  /**
   * include string could be
   *    referring self like:              $base or $self
   *    referring from repository like:   #otherRule
   *    referring other lang's repo like: other-lang#otherRule
   */
  include: string,
  options?:Partial<{
    readonly $impostureLang: Record<string, any>;
    readonly name?: string;
    readonly contentName?: string;
  }>
):IRawRule{
  return {
    include,
    ...options,
  }
}

export function createCapture(
  captures: IRawCapturesMap,
  type?:string,
  options?:Partial<{
    readonly $impostureLang: Record<string, any>;
  }>
):IRawCaptures{
  for (const captureKey in captures){
    captures[captureKey].$impostureLang = captures[captureKey].$impostureLang ?? create$impostureLang(`${type? type+'-': ''}c-${captureKey}`)
  }
  return {
    ...captures,
    ...options
  }
}

export function createMatch(
  match:string,
  type?: string,
  options?:Partial<{
    readonly $impostureLang: Record<string, any>;
    readonly captures?: IRawCaptures;
    readonly name?: string;
  }>
): IRawRule{
  return {
    match,
    ...options,
    $impostureLang: !!options?.$impostureLang? options.$impostureLang :
      (!!type || !!options?.name)?
        create$impostureLang(type ?? options!.name!):
        undefined
  };
}

export function createPatterns(
  patterns: IRawRule[],
  type?: string,
  options?:Partial<{
    readonly $impostureLang: Record<string, any>;
    readonly name?: string;
    readonly contentName?: string;
  }>
): IRawRule{
  if (patterns.length === 0){
    throw new Error('Cannot create an include rule of no patterns');
  }
  return {
    patterns,
    ...options,
    $impostureLang: !!options?.$impostureLang? options.$impostureLang : create$impostureLang(type)
  };
}

export function createBeginEnd(
  begin:string,
  end:string,
  patterns:IRawRule[] = [],
  type?: string,
  options?:Partial<{
    readonly $impostureLang: Record<string, any>;
    readonly beginCaptures?: IRawCaptures;
    readonly endCaptures?: IRawCaptures;
    readonly applyEndPatternLast?: boolean;
    readonly name?: string;
    readonly contentName?: string;
  }>
): IRawRule{
  return {
    begin,
    end,
    patterns: patterns.length? patterns: undefined,
    ...options,
    $impostureLang: !!options?.$impostureLang? options.$impostureLang : create$impostureLang(type)
  };
}

export function createBeginWhile(
  begin:string,
  _while:string,
  patterns:IRawRule[] = [],
  type?: string,
  options?:Partial<{
    readonly $impostureLang: Record<string, any>;
    readonly beginCaptures?: IRawCaptures;
    readonly whileCaptures?: IRawCaptures;
    readonly name?: string;
    readonly contentName?: string;
  }>
): IRawRule{
  return {
    begin,
    while: _while,
    patterns: patterns.length? patterns: undefined,
    ...options,
    $impostureLang: !!options?.$impostureLang? options.$impostureLang :create$impostureLang(type)
  };
}

export function createGrammar(
  scopeName: string,
  patterns: IRawRule[],
  repository: IRawRuleRepository,
  options?: Partial<{
    readonly $impostureLang: Record<string, any>;
    readonly injections?: {[expression: string]: IRawRule};
    readonly injectionSelector?: string;

    readonly fileTypes?: string[];
    readonly name?: string;
    readonly firstLineMatch?: string;
  }>,
): IRawGrammar{
  return {
    scopeName,
    patterns,
    repository,
    ...options,
    // $impostureLang: !!options?.$impostureLang? options.$impostureLang : create$impostureLang(scopeName)
  } as IRawGrammar;
}

export const $self = createInclude('$self');
export const $base = createInclude('$base');