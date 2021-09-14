import {ASTNode, IGrammar, IRawTheme, Registry} from '@monaco-imposture-tools/core';
import {default as monaco} from './editor.api';
import {themes} from "./themes";

export const SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME = '_$functionReturnType';

export type DataType =
  | 'dualAtSymbol'
  | 'atSymbol'
  | 'atTemplateSubstitutionElement'
  | 'root-function-call-expression'
  | 'parentheses'
  | 'comma'
  | 'function-call-complete'
  | 'function-call'
  | 'function-call-target'
  | 'identifiers'
  | 'identifiers:wPunctuation'
  | 'identifiers-capture'
  | 'object-identifiers'
  | 'object-identifiers:wPunctuation'
  | 'object-identifiers-captures'
  | 'punctuation'
  | 'punctuation-capture'
  | 'array-literal'
  | 'number'
  | 'string'
  | 'boolean'
  | 'null';

interface $impostureLangType<T = DataType> {
  type?: string;
  dataType?: T;
  namespaces: string[];
}

export type AzLogicAppNodeType<T extends DataType> = AzLogicAppNode & {
  $impostureLang?: $impostureLangType<T>;
};

export type AzLogicAppNode = ASTNode & {
  $impostureLang?: $impostureLangType<any>;
};

export type ReturnChainType =
  | UnknownReturnChainType
  | PrimitiveReturnChainType
  | ArrayLiteralReturnChainType
  | FunctionCallReturnChainType
  | IdentifierReturnChainType
  | IdentifierInBracketNotationReturnChainType;
interface AbstractReturnChainType {
  type: DataType | 'unknown';
  label: string;
  node: ASTNode;
}
export interface UnknownReturnChainType extends AbstractReturnChainType {
  type: Exclude<
    AbstractReturnChainType['type'],
    | PrimitiveReturnChainType['type']
    | ArrayLiteralReturnChainType['type']
    | FunctionCallReturnChainType['type']
    | IdentifierReturnChainType['type']
    | IdentifierInBracketNotationReturnChainType['type']
  >;
  content: string;
}
export interface PrimitiveReturnChainType extends AbstractReturnChainType {
  type: 'number' | 'string' | 'boolean' | 'null';
}
export interface ArrayLiteralReturnChainType extends AbstractReturnChainType {
  type: 'array-literal';
}
export interface FunctionCallReturnChainType extends AbstractReturnChainType {
  type: 'function-call-complete';
  functionFullName: string;
}
export interface IdentifierReturnChainType extends AbstractReturnChainType {
  type: 'identifiers' | 'identifiers:wPunctuation' | 'object-identifiers' | 'object-identifiers:wPunctuation';
  identifierName: string;
}
export interface IdentifierInBracketNotationReturnChainType extends AbstractReturnChainType {
  type: 'array-literal';
  isBracketNotation: true;
  identifierName: string;
  punctuationNode: AzLogicAppNodeType<'punctuation'>;
  propertyNameNode: AzLogicAppNodeType<'string'>;
  propertyNameOffset: number;
  propertyNameLength: number;
}

export enum ParenthesesElderSiblingType {
  UNKNOWN = 0xa00,
  NOT_FOUND = 0xa01,
  FUNCTION_CALL = 0xa02,
  BENEATH_A_PAIR_OF_PARENTHESES = 0xa03,
}

export enum DescriptionType {
  FunctionValue = 0x101,
  OverloadedFunctionValue,
  ReferenceValue,
  PackageReference,
}

export interface IDescCollItem{
  type: 'basic' | 'emptyParaFunctionReturn' | 'overloadedFunction'
}

export class DescCollItem implements IDescCollItem{

  type = 'basic' as const;

  public constructor(
    public readonly vd: ValueDescription
  ) {}

  get isFunction(){
    return this.vd._$type === DescriptionType.FunctionValue
  }

  get areAllParaConstant():boolean{
    return this.isFunction &&
        (this.vd as FunctionValueDescription)._$parameterTypes.length &&
        (this.vd as FunctionValueDescription)._$parameterTypes
          .every(value => value.type === IdentifierTypeName.CONSTANT) ;
  }

  get functionParameters(){
    if (this.isFunction){
      return (this.vd as FunctionValueDescription)._$parameterTypes;
    }
    return [];
  }

}

export class EmptyParaRetDescCollItem implements IDescCollItem {

  type = 'emptyParaFunctionReturn' as const;

  constructor(
    public readonly funVd: FunctionValueDescription | OverloadedFunctionValueDescription,
    public readonly returnPath: string[],
    public readonly returnVd: ValueDescription,
    public readonly overloadedFunParaIndex?: number,
  ) {
  }
}

export class OlFunDescCollItem implements IDescCollItem {

  type = 'overloadedFunction' as const;

  constructor(
    public readonly overloadedFunVd: OverloadedFunctionValueDescription,
    public readonly overloadedIndex: number,
  ) {
  }

  get areAllParaConstant():boolean{
    return this.overloadedFunVd._$parameterTypes[this.overloadedIndex].length &&
      this.overloadedFunVd._$parameterTypes[this.overloadedIndex].every(value =>
        value.type === IdentifierTypeName.CONSTANT
      )
  }

  get functionParameters(){
    return this.overloadedFunVd._$parameterTypes[this.overloadedIndex];
  }

}

export type DescCollItemTyp = DescCollItem| EmptyParaRetDescCollItem| OlFunDescCollItem

export interface DescriptorCollection<T extends string[] = string[]> {
  paths: T;
  valDescCollItem: DescCollItemTyp;
}


export enum IdentifierTypeName {
  Any = 0x001,
  Boolean,
  String,
  Number,
  AnyObject,
  Array,
  StringArray,
  NumberArray,
  Null,
  XML,
  ArrayList,
  StringArrayList,
  NumberArrayList,
  AnyObjectList,
  FUNCTION, // todo what if we gonna multi constants vals for one return type
  CONSTANT, // todo what if we gonna multi constants vals for one return type
  FUNCTION_RETURN_TYPE,
  OBJECT,

  INTERNAL_PKG_REF,
  INTERNAL_FUN_REF,
  INTERNAL_OL_FUN_REF,
}

export class IdentifierType {
  static Any = new IdentifierType(IdentifierTypeName.Any);
  static Boolean = new IdentifierType(IdentifierTypeName.Boolean);
  static String = new IdentifierType(IdentifierTypeName.String);
  static Number = new IdentifierType(IdentifierTypeName.Number);
  static AnyObject = new IdentifierType(IdentifierTypeName.AnyObject);
  static Array = new IdentifierType(IdentifierTypeName.Array);
  static StringArray = new IdentifierType(IdentifierTypeName.StringArray);
  static NumberArray = new IdentifierType(IdentifierTypeName.NumberArray);
  static Null = new IdentifierType(IdentifierTypeName.Null);
  static XML = new IdentifierType(IdentifierTypeName.XML);
  static ArrayList = new IdentifierType(IdentifierTypeName.ArrayList);
  static StringArrayList = new IdentifierType(IdentifierTypeName.StringArrayList);
  static NumberArrayList = new IdentifierType(IdentifierTypeName.NumberArrayList);
  static AnyObjectList = new IdentifierType(IdentifierTypeName.AnyObjectList);

  static FUNCTION = (functionParameterTypes: IdentifierType[], functionReturnType: IdentifierType) =>
    new IdentifierType(IdentifierTypeName.FUNCTION, {functionParameterTypes, functionReturnType});
  static OBJECT = (objValTypChainList: string[]) => new IdentifierType(IdentifierTypeName.OBJECT, {objValTypChainList});
  static CONSTANT = (constantValue:  string | number | null) => new IdentifierType(IdentifierTypeName.CONSTANT, {constantValue});
  static FUNCTION_RETURN_TYPE = (chainList: string[]) =>
    new IdentifierType(IdentifierTypeName.FUNCTION_RETURN_TYPE, {
      returnTypeChainList:[
        SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME, ...chainList
      ]
    });

  static INTERNAL_PKG_REF = (packageDescription:PackageDescription)=>
    new IdentifierType(IdentifierTypeName.INTERNAL_PKG_REF, {packageDescription});
  static INTERNAL_FUN_REF = (functionValueDescription:FunctionValueDescription)=>
    new IdentifierType(IdentifierTypeName.INTERNAL_FUN_REF, {functionValueDescription});
  static INTERNAL_OL_FUN_REF = (overloadedFunctionValueDescription:OverloadedFunctionValueDescription)=>
    new IdentifierType(IdentifierTypeName.INTERNAL_OL_FUN_REF, {overloadedFunctionValueDescription});

  // CONSTANT
  public readonly constantValue?: string | number | null;
  // FUNCTION_RETURN_TYPE
  public readonly returnTypeChainList?: string[];
  // Function
  public readonly functionParameterTypes?: IdentifierType[];
  public readonly functionReturnType?: IdentifierType;
  // OBJECT
  public readonly objValTypChainList?: string[];

  // internal package reference
  public readonly packageDescription?: PackageDescription;
  // internal function reference
  public readonly functionValueDescription?: FunctionValueDescription;
  // internal overloaded function reference
  public readonly overloadedFunctionValueDescription?: OverloadedFunctionValueDescription;

  private constructor(
    public readonly type: IdentifierTypeName,
    option: Partial<{
      // CONSTANT
      constantValue:  string | number | null;
      // FUNCTION_RETURN_TYPE
      returnTypeChainList: string[];
      // Function
      functionParameterTypes: IdentifierType[];
      functionReturnType: IdentifierType;
      // OBJECT
      objValTypChainList: string[];
      // internal package reference
      packageDescription: PackageDescription;
      // internal function reference
      functionValueDescription: FunctionValueDescription;
      // internal overloaded function reference
      overloadedFunctionValueDescription: OverloadedFunctionValueDescription;
    }> = {}
  ) {
    if (type === IdentifierTypeName.FUNCTION) {
      if (!Array.isArray(option.functionParameterTypes) || !option.functionReturnType) {
        new Error(`Incorrect function identifier: functionParameterTypes or functionReturnType missing`);
      }
    } else if (type === IdentifierTypeName.CONSTANT) {
      if (
        !(typeof option.constantValue === 'number' ||
        typeof option.constantValue === 'string' ||
        option.constantValue === null)
      ) {
        new Error(`Incorrect constant identifier: constantValue missing`);
      }
    } else if (type === IdentifierTypeName.FUNCTION_RETURN_TYPE) {
      if (!Array.isArray(option.returnTypeChainList)) {
        new Error(`Incorrect function return type identifier: returnTypeChainList missing`);
      }
    } else if (type === IdentifierTypeName.OBJECT) {
      if (!Array.isArray(option.objValTypChainList)) {
        new Error(`Incorrect object value type identifier: objValTypChainList missing`);
      }
    } else if (type === IdentifierTypeName.INTERNAL_PKG_REF){
      if (!option.packageDescription){
        new Error(`Incorrect internal package identifier: packageDescription missing`);
      }
    } else if (type === IdentifierTypeName.INTERNAL_FUN_REF){
      if (!option.functionValueDescription){
        new Error(`Incorrect internal function identifier: functionValueDescription missing`);
      }
    } else if (type === IdentifierTypeName.INTERNAL_OL_FUN_REF){
      if (!option.overloadedFunctionValueDescription){
        new Error(`Incorrect internal overloaded function identifier: overloadedFunctionValueDescription missing`);
      }
    }
    Object.assign(this, option);
  }

  get constantLabel():string{
    if (this.type === IdentifierTypeName.CONSTANT){
      return '' + this.constantValue;
    }
    return '';
  }

  get constantStringValue():string{
    if (this.type === IdentifierTypeName.CONSTANT){
      if (typeof this.constantValue === 'string'){
        return `'${this.constantValue}'`
      }
      return '' + this.constantValue;
    }
    return '';
  }


  get label(): string {
    switch (this.type) {
      case IdentifierTypeName.Any:
        return 'any';
      case IdentifierTypeName.Boolean:
        return 'boolean';
      case IdentifierTypeName.String:
        return 'string';
      case IdentifierTypeName.Number:
        return 'number';
      case IdentifierTypeName.AnyObject:
        return 'anyObject';
      case IdentifierTypeName.Array:
        return 'array';
      case IdentifierTypeName.StringArray:
        return 'arrayOfStrings';
      case IdentifierTypeName.NumberArray:
        return 'arrayOfNumbers';
      case IdentifierTypeName.Null:
        return 'null';
      case IdentifierTypeName.XML:
        return 'xml';
      case IdentifierTypeName.ArrayList:
        return 'any list item';
      case IdentifierTypeName.StringArrayList:
        return 'string list item';
      case IdentifierTypeName.NumberArrayList:
        return 'number list item';
      case IdentifierTypeName.AnyObjectList:
        return 'anyObject list item';
      case IdentifierTypeName.FUNCTION:
        return 'composite:function';
      case IdentifierTypeName.OBJECT:
        return 'composite:object';
      case IdentifierTypeName.CONSTANT:
        return this.constantStringValue;
      case IdentifierTypeName.FUNCTION_RETURN_TYPE:
        return 'composite:functionReturnType';
      case IdentifierTypeName.INTERNAL_PKG_REF:
        return `package::${this.packageDescription._$desc[0]}`
      case IdentifierTypeName.INTERNAL_FUN_REF:
        return `function::${this.functionValueDescription._$desc[0]}`
      case IdentifierTypeName.INTERNAL_OL_FUN_REF:
        return `function::${this.overloadedFunctionValueDescription._$desc[0]}`
      default:
        return 'unknown';
    }
  }

  get isAnyObject(): boolean {
    return (
      this.type === IdentifierTypeName.Any ||
      this.type === IdentifierTypeName.AnyObject ||
      this.type === IdentifierTypeName.AnyObjectList
    );
  }

  get isComposite(): boolean {
    return (
      this.type === IdentifierTypeName.FUNCTION ||
      this.type === IdentifierTypeName.OBJECT ||
      this.type === IdentifierTypeName.CONSTANT ||
      this.type === IdentifierTypeName.FUNCTION_RETURN_TYPE
    );
  }

  get isVarList(): boolean {
    return (
      this.type === IdentifierTypeName.ArrayList ||
      this.type === IdentifierTypeName.StringArrayList ||
      this.type === IdentifierTypeName.NumberArrayList ||
      this.type === IdentifierTypeName.AnyObjectList
    );
  }

  get isObject(): boolean {
    return (
      this.type === IdentifierTypeName.Any ||
      this.type === IdentifierTypeName.AnyObject ||
      this.type === IdentifierTypeName.XML ||
      this.type === IdentifierTypeName.ArrayList ||
      this.type === IdentifierTypeName.AnyObjectList
    );
  }

  get isArray(): boolean {
    return (
      this.type === IdentifierTypeName.Any ||
      this.type === IdentifierTypeName.Array ||
      this.type === IdentifierTypeName.StringArray ||
      this.type === IdentifierTypeName.NumberArray
    );
  }

  get returnTypeCandidates(): IdentifierType[] {
    if (this.type === IdentifierTypeName.ArrayList || this.type === IdentifierTypeName.Any) {
      return [
        IdentifierType.Any,
        IdentifierType.Boolean,
        IdentifierType.String,
        IdentifierType.Number,
        IdentifierType.AnyObject,
        IdentifierType.StringArray,
        IdentifierType.NumberArray,
        IdentifierType.Null,
        IdentifierType.XML,
        IdentifierType.ArrayList,
        IdentifierType.StringArrayList,
        IdentifierType.NumberArrayList,
        IdentifierType.AnyObjectList,
      ];
    } else if (this.isVarList) {
      switch (this.type) {
        case IdentifierTypeName.StringArrayList:
          return [IdentifierType.Any, IdentifierType.String];
        case IdentifierTypeName.NumberArrayList:
          return [IdentifierType.Any, IdentifierType.NumberArray];
        case IdentifierTypeName.AnyObjectList:
          return [IdentifierType.Any, IdentifierType.AnyObject, IdentifierType.XML];
        default:
          return [IdentifierType.Any, this];
      }
    } else if (this.isArray) {
      switch (this.type) {
        case IdentifierTypeName.Array:
          return [
            IdentifierType.Any,
            IdentifierType.Array,
            IdentifierType.StringArray,
            IdentifierType.NumberArray,
            IdentifierType.ArrayList,
            IdentifierType.StringArrayList,
            IdentifierType.NumberArrayList,
            IdentifierType.AnyObjectList,
          ];
        case IdentifierTypeName.StringArray:
          return [IdentifierType.Any, IdentifierType.StringArray, IdentifierType.StringArrayList];
        case IdentifierTypeName.NumberArray:
          return [IdentifierType.Any, IdentifierType.NumberArray, IdentifierType.NumberArrayList];
        default:
          return [IdentifierType.Any, this];
      }
    } else {
      return [IdentifierType.Any, this];
    }
  }

  /**
   * assign source to target
   * @param source
   * @param target
   */
  assignableTo(target?: IdentifierType): boolean {
    if (!this) return false;
    if (!target) return false;
    if (this === IdentifierType.Any || target === IdentifierType.Any) {
      return true;
    }
    if (target === IdentifierType.Array && this.isArray) {
      return true;
    }

    if (target === IdentifierType.AnyObject && this.isObject) {
      return true;
    }

    if (target === IdentifierType.ArrayList) {
      return true;
    }

    if (
      target === IdentifierType.StringArrayList &&
      (this === IdentifierType.String || this === IdentifierType.StringArrayList)
    ) {
      return true;
    }

    if (
      target === IdentifierType.NumberArrayList &&
      (this === IdentifierType.Number || this === IdentifierType.StringArrayList)
    ) {
      return true;
    }

    if (
      target === IdentifierType.AnyObjectList &&
      (this === IdentifierType.AnyObject || this === IdentifierType.XML || this === IdentifierType.AnyObjectList)
    ) {
      return true;
    }

    // todo: implement the deep comparison b/w CONSTANT and FUNCTION_RETURN_TYPE types

    return this === target;
  }
}

export type ValueDescription =
  | FunctionValueDescription
  | OverloadedFunctionValueDescription
  | ReferenceValueDescription
  | PackageDescription;

export interface AbstractValueDescription {
  _$type: DescriptionType;
  _$desc: string[];
  _$isOptional?: boolean;
}

export interface FunctionValueDescription extends AbstractValueDescription {
  _$type: typeof DescriptionType.FunctionValue;
  _$parameterTypes: IdentifierType[];
  _$returnType: IdentifierType;
  _$identifierType:IdentifierType;
}

export function createFunValDesc(
  descStrings: string[],
  parameterTypes: IdentifierType[],
  returnType: IdentifierType
): FunctionValueDescription {
  const funVd = {
    _$type: DescriptionType.FunctionValue,
    _$desc: descStrings,
    _$parameterTypes: parameterTypes,
    _$returnType: returnType,
  } as FunctionValueDescription;
  funVd._$identifierType = IdentifierType.INTERNAL_FUN_REF(funVd);
  return funVd;
}

export interface OverloadedFunctionValueDescription extends AbstractValueDescription {
  _$type: typeof DescriptionType.OverloadedFunctionValue;
  _$parameterTypes: IdentifierType[][];
  _$returnType: IdentifierType[];
  _$identifierType:IdentifierType;
}

export function createOverloadedFunValDesc(
  descStrings: string[],
  parameterTypes: IdentifierType[][],
  returnType: IdentifierType[]
): OverloadedFunctionValueDescription {
  if (parameterTypes.length !== returnType.length) {
    new Error(`Incorrect overloaded function description: the size of parameterTypes mismatches with returnType's`);
  }
  const olFunVd = {
    _$type: DescriptionType.OverloadedFunctionValue,
    _$desc: descStrings,
    _$parameterTypes: parameterTypes,
    _$returnType: returnType,
  } as OverloadedFunctionValueDescription;
  olFunVd._$identifierType = IdentifierType.INTERNAL_OL_FUN_REF(olFunVd);
  return olFunVd as OverloadedFunctionValueDescription
}

export interface ReferenceValueDescription extends AbstractValueDescription {
  _$type: DescriptionType.ReferenceValue;
  _$valueType: IdentifierType;
  _$value?: any;
}

export function createRefValDesc(
  descStrings: string[],
  valueType: IdentifierType,
  optional?: boolean,
  value?: any
): ReferenceValueDescription {
  return {
    _$type: DescriptionType.ReferenceValue,
    _$desc: descStrings,
    _$valueType: valueType,
    _$value: value,
    _$isOptional: optional,
  };
}

export interface PackageDescription extends AbstractValueDescription {
  _$type: DescriptionType.PackageReference;
  _$subDescriptor: Record<string, ValueDescription>;
  _$identifierType:IdentifierType;
}

export function createPkgValDesc(
  descStrings: string[],
  subDescriptor: Record<string, ValueDescription>
): PackageDescription {
  const pkgDesc = {
    _$type: DescriptionType.PackageReference,
    _$desc: descStrings,
    _$subDescriptor: subDescriptor,
  } as PackageDescription;
  pkgDesc._$identifierType = IdentifierType.INTERNAL_PKG_REF(pkgDesc);
  return pkgDesc as PackageDescription;
}

export function createFunRetDesc(desc:PackageDescription){
  return {
    _$functionReturnType:desc
  }
}

export type SymbolTable = ValueDescription & {
  _$functionReturnType: PackageDescription;
};

export const ValueDescriptionDictionaryFunctionKey = '_$ValueDescriptionDictionaryFunctionKey';
export type ValueDescriptionDictionary = Map<IdentifierType | string, DescriptorCollection[]>;

export class AzLogicAppLangConstants{

  static readonly SCOPE_NAME = 'source.azLgcAppExp'; // source.js      ->    source.azLgcAppExp
  static readonly LANGUAGE_ID = 'azureLogicAppExpression'; // javascript     ->    azureLogicAppExpression
  static readonly DEFAULT_EDITOR_ID = 'az-lg-app-exp-default-editor';

  static inLexicalDebugMode = false;
  static inSyntaxDebugMode = false;
  static inSemanticDebugMode = false;

  static _init: Promise<any> | undefined = undefined;
  static _registry: Registry | undefined = undefined;

  static _grammar: IGrammar | undefined = undefined;
  static _theme: IRawTheme = themes['default'];
  static _usingBuiltInTheme = true;

  static _monaco: typeof monaco | undefined;

  static readonly emtpyFunRetTyp = createFunRetDesc(createPkgValDesc([], {}));
  static readonly  globalSymbolTableBase = Object.freeze({

    // collection functions
    contains: createOverloadedFunValDesc(
      [
        '**contains(string, string):boolean**',
        '**contains(array, array):boolean**',
        '**contains(object, object):boolean**',
        'Check whether a collection has a specific item.',
      ],
      [
        [IdentifierType.String, IdentifierType.String],
        [IdentifierType.Array, IdentifierType.Array],
        [IdentifierType.AnyObject, IdentifierType.AnyObject],
      ],
      [IdentifierType.Boolean, IdentifierType.Boolean, IdentifierType.Boolean]
    ),
    empty: createOverloadedFunValDesc(
      [
        '**empty(string):boolean**',
        '**empty(array):boolean**',
        '**empty(object):boolean**',
        "Returns true if object, array, or string is empty. For example, the following expression returns true: empty('')",
      ],
      [[IdentifierType.String], [IdentifierType.Array], [IdentifierType.AnyObject]],
      [IdentifierType.Boolean, IdentifierType.Boolean, IdentifierType.Boolean]
    ),
    first: createOverloadedFunValDesc(
      [
        '**first(string):boolean**',
        '**first(array):boolean**',
        'Returns the first element in the array or string passed in. For example, this function returns 0: first([0,2,3])',
      ],
      [[IdentifierType.String], [IdentifierType.Array]],
      [IdentifierType.Boolean, IdentifierType.Boolean]
    ),
    intersection: createOverloadedFunValDesc(
      [
        '**intersection(object, object):object**',
        '**intersection(array, array):array**',
        'Returns a single array or object with the common elements between the arrays or objects passed to it. For example, this function returns [1, 2]: intersection([1, 2, 3], [101, 2, 1, 10],[6, 8, 1, 2]). The parameters for the function can either be a set of objects or a set of arrays (not a mixture thereof). If there are two objects with the same name, the last object with that name appears in the final object.',
      ],
      [
        [IdentifierType.AnyObject, IdentifierType.AnyObject],
        [IdentifierType.Array, IdentifierType.Array],
      ],
      [IdentifierType.AnyObject, IdentifierType.Array]
    ),
    join: createOverloadedFunValDesc(
      [
        '**join(object, object):string**',
        '**join(array, array):string**',
        'Return a string that has all the items from an array and has each character separated by a delimiter.',
      ],
      [
        [IdentifierType.String, IdentifierType.String],
        [IdentifierType.Array, IdentifierType.Array],
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    last: createOverloadedFunValDesc(
      [
        '**last(string):string**',
        '**last(array):any**',
        'Returns the last element in the array or string passed in. For example, this function returns 3: last([0,2,3])',
      ],
      [[IdentifierType.String], [IdentifierType.Array]],
      [IdentifierType.String, IdentifierType.Any]
    ),
    length: createOverloadedFunValDesc(
      [
        '**length(string):number**',
        '**length(array):number**',
        'Returns the last element in the array or string passed in. For example, this function returns 3: last([0,2,3])',
      ],
      [[IdentifierType.String], [IdentifierType.Array]],
      [IdentifierType.Number, IdentifierType.Number]
    ),
    skip: createOverloadedFunValDesc(
      [
        '**skip(array):array**',
        '**skip(integer):array**',
        'Returns the elements in the array starting at index Count, for example this function returns [3, 4]: skip([1, 2 ,3 ,4], 2)',
      ],
      [[IdentifierType.Array], [IdentifierType.Number]],
      [IdentifierType.String, IdentifierType.String]
    ),
    take: createOverloadedFunValDesc(
      [
        '**take(array, number):array**',
        '**take(string, number):array**',
        'Returns the first Count elements from the array or string passed in, for example this function returns [1, 2]: take([1, 2, 3, 4], 2)',
      ],
      [
        [IdentifierType.Array, IdentifierType.Number],
        [IdentifierType.String, IdentifierType.Number],
      ],
      [IdentifierType.Number, IdentifierType.Number]
    ),
    union: createOverloadedFunValDesc(
      [
        '**union(array, number):array**',
        '**union(string, number):array**',
        'Returns a single array or object with all of the elements that are in either array or object passed to it. For example, this function returns [1, 2, 3, 10, 101] : union([1, 2, 3], [101, 2, 1, 10]). The parameters for the function can either be a set of objects or a set of arrays (not a mixture thereof). If there are two objects with the same name in the final output, the last object with that name appears in the final object.',
      ],
      [[IdentifierType.ArrayList], [IdentifierType.AnyObjectList]],
      [IdentifierType.Array, IdentifierType.AnyObject]
    ),
    //*********conversion functions
    array: createFunValDesc(
      [
        '**array(...string):string**',
        'Convert the parameter to an array. For example, the following expression returns ["abc"]: array(\'abc\')',
      ],
      [IdentifierType.ArrayList],
      IdentifierType.Array
    ),
    base64: createFunValDesc(
      ['**base64(string):string**', 'Return the base64-encoded version for a string.'],
      [IdentifierType.String],
      IdentifierType.String
    ),
    base64ToBinary: createFunValDesc(
      ['**base64ToBinary(string):string**', 'Return the base64-encoded version for a string.'],
      [IdentifierType.String],
      IdentifierType.String
    ),
    base64ToString: createFunValDesc(
      [
        '**base64ToString(string):string**',
        'Return the string version for a base64-encoded string, effectively decoding the base64 string.',
      ],
      [IdentifierType.String],
      IdentifierType.String
    ),
    binary: createFunValDesc(
      ['**binary(string):string**', 'Return the binary version for a string.'],
      [IdentifierType.String],
      IdentifierType.String
    ),
    bool: createFunValDesc(
      ['**bool(any):string**', 'Return the Boolean version for a value.'],
      [IdentifierType.AnyObject],
      IdentifierType.Boolean
    ),
    coalesce: createFunValDesc(
      [
        '**coalesce(...any[]):any**',
        'Return the first non-null value from one or more parameters. Empty strings, empty arrays, and empty objects are not null.',
      ],
      [IdentifierType.ArrayList],
      IdentifierType.Any
    ),
    createArray: createFunValDesc(
      ['**createArray(...any[]):any[]**', 'Return an array from multiple inputs.'],
      [IdentifierType.ArrayList],
      IdentifierType.Array
    ),
    dataUri: createFunValDesc(
      ['**dataUri(string):string**', 'Return a data uniform resource identifier (URI) for a string.'],
      [IdentifierType.String],
      IdentifierType.String
    ),
    dataUriToBinary: createFunValDesc(
      [
        '**dataUriToBinary(string):string**',
        'Return the binary version for a data uniform resource identifier (URI). ',
      ],
      [IdentifierType.String],
      IdentifierType.String
    ),
    dataUriToString: createFunValDesc(
      ['**dataUriToString(string):string**', 'Return the string version for a data uniform resource identifier (URI).'],
      [IdentifierType.String],
      IdentifierType.String
    ),
    decodeBase64: createFunValDesc(
      [
        '**decodeBase64(string):string**',
        'Return the string version for a base64-encoded string, effectively decoding the base64 string.',
      ],
      [IdentifierType.String],
      IdentifierType.String
    ),
    decodeDataUri: createFunValDesc(
      ['**decodeDataUri(string):string**', 'Return the binary version for a data uniform resource identifier (URI).'],
      [IdentifierType.String],
      IdentifierType.String
    ),
    decodeUriComponent: createFunValDesc(
      [
        '**decodeUriComponent(string):string**',
        'Return a string that replaces escape characters with decoded versions.',
      ],
      [IdentifierType.String],
      IdentifierType.String
    ),
    encodeUriComponent: createFunValDesc(
      [
        '**encodeUriComponent(string):string**',
        'Return a uniform resource identifier (URI) encoded version for a string by replacing URL-unsafe characters with escape characters.',
      ],
      [IdentifierType.String],
      IdentifierType.String
    ),
    float: createFunValDesc(
      [
        '**float(string):number**',
        'Convert a string version for a floating-point number to an actual floating point number.',
      ],
      [IdentifierType.String],
      IdentifierType.Number
    ),
    int: createFunValDesc(
      ['**int(string):number**', 'Return the integer version for a string.'],
      [IdentifierType.String],
      IdentifierType.Number
    ),
    json: createOverloadedFunValDesc(
      [
        '**json(string|xml):object**',
        'Return the JavaScript Object Notation (JSON) type value or object for a string or XML.',
      ],
      [[IdentifierType.String], [IdentifierType.XML]],
      [IdentifierType.AnyObject, IdentifierType.AnyObject]
    ),
    string: createFunValDesc(
      ['**string(any):string**', 'Return the string version for a value.'],
      [IdentifierType.Any],
      IdentifierType.String
    ),
    uriComponentToBinary: createFunValDesc(
      [
        '**uriComponentToBinary(string):string**',
        'Return the binary version for a uniform resource identifier (URI) component.',
      ],
      [IdentifierType.String],
      IdentifierType.String
    ),
    uriComponentToString: createFunValDesc(
      [
        '**uriComponentToString(string):string**',
        'Return the string version for a uniform resource identifier (URI) encoded string, effectively decoding the URI-encoded string.',
      ],
      [IdentifierType.String],
      IdentifierType.String
    ),
    xml: createFunValDesc(
      ['**xml(string):object**', 'Return the XML version for a string that contains a JSON object.'],
      [IdentifierType.String],
      IdentifierType.AnyObject
    ),
    xpath: createFunValDesc(
      [
        '**xpath(any, any):any**',
        'Check XML for nodes or values that match an XPath (XML Path Language) expression, and return the matching nodes or values. An XPath expression, or just "XPath", helps you navigate an XML document structure so that you can select nodes or compute values in the XML content.',
      ],
      [IdentifierType.Any, IdentifierType.Any],
      IdentifierType.Any
    ),
    //*********date functions
    addToTime: createFunValDesc(
      ['**addToTime(string, number, string, string):string**', 'Add a number of time units to a timestamp. '],
      [IdentifierType.String, IdentifierType.Number, IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    addDays: createFunValDesc(
      ['**addDays(string, number, string):string**', 'Add a number of days to a timestamp.'],
      [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
      IdentifierType.String
    ),
    addHours: createFunValDesc(
      ['**addHours(string, number, string):string**', 'Add a number of hours to a timestamp.'],
      [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
      IdentifierType.String
    ),
    addMinutes: createFunValDesc(
      ['**addMinutes(string, number, string):string**', 'Add a number of minutes to a timestamp.'],
      [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
      IdentifierType.String
    ),
    addSeconds: createFunValDesc(
      ['**addSeconds(string, number, string):string**', 'Add a number of seconds to a timestamp.'],
      [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
      IdentifierType.String
    ),
    convertFromUtc: createFunValDesc(
      [
        '**convertFromUtc(string, string, string):string**',
        'Convert a timestamp from Universal Time Coordinated (UTC) to the target time zone.',
      ],
      [IdentifierType.String, IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    convertTimeZone: createFunValDesc(
      [
        '**convertTimeZone(string, string, string):string**',
        'Convert a timestamp from the source time zone to the target time zone.',
      ],
      [IdentifierType.String, IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    convertToUtc: createFunValDesc(
      [
        '**convertToUtc(string, string, string):string**',
        'Convert a timestamp from the source time zone to Universal Time Coordinated (UTC).',
      ],
      [IdentifierType.String, IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    dayOfMonth: createFunValDesc(
      ['**dayOfMonth(string):Integer**', 'Return the day of the month from a timestamp.'],
      [IdentifierType.String],
      IdentifierType.Number
    ),
    dayOfWeek: createFunValDesc(
      ['**dayOfWeek(string):Integer**', 'Return the day of the week from a timestamp.'],
      [IdentifierType.String],
      IdentifierType.Number
    ),
    dayOfYear: createFunValDesc(
      ['**dayOfYear(string):Integer**', 'Return the day of the year from a timestamp.'],
      [IdentifierType.String],
      IdentifierType.Number
    ),
    formatDateTime: createFunValDesc(
      ['**formatDateTime(string, string):string**', 'Return a timestamp in the specified format.'],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    getFutureTime: createFunValDesc(
      [
        '**getFutureTime(number, string, string):string**',
        'Return the current timestamp plus the specified time units.',
      ],
      [IdentifierType.Number, IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    getPastTime: createFunValDesc(
      [
        '**getPastTime(number, string, string):string**',
        'Return the current timestamp minus the specified time units.',
      ],
      [IdentifierType.Number, IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    startOfDay: createFunValDesc(
      ['**startOfDay(string, string):string**', 'Return the start of the day for a timestamp.'],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    startOfHour: createFunValDesc(
      ['**startOfHour(string, string):string**', 'Return the start of the hour for a timestamp.'],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    startOfMonth: createFunValDesc(
      ['**startOfMonth(string, string):string**', 'Return the start of the month for a timestamp.'],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    subtractFromTime: createFunValDesc(
      [
        '**subtractFromTime(string, integer, string, string):string**',
        'Subtract a number of time units from a timestamp. See also getPastTime.',
      ],
      [IdentifierType.String, IdentifierType.Number, IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    ticks: createFunValDesc(
      [
        '**ticks(string):Integer**',
        'Return the ticks property value for a specified timestamp. A tick is a 100-nanosecond interval.',
      ],
      [IdentifierType.String],
      IdentifierType.Number
    ),
    utcNow: createFunValDesc(
      ['**utcNow(string):string**', 'Return the current timestamp.'],
      [IdentifierType.String],
      IdentifierType.String
    ),
    //*********logical functions
    and: createFunValDesc(
      [
        '**and(boolean, boolean):boolean**',
        'Check whether both expressions are true. Return true when both expressions are true, or return false when at least one expression is false.',
      ],
      [IdentifierType.Boolean, IdentifierType.Boolean],
      IdentifierType.Boolean
    ),
    equals: createFunValDesc(
      [
        '**equals(any, any):boolean**',
        "Check whether both values, expressions, or objects are equivalent. Return true when both are equivalent, or return false when they're not equivalent.",
      ],
      [IdentifierType.Any, IdentifierType.Any],
      IdentifierType.Boolean
    ),
    greater: createFunValDesc(
      [
        '**greater(any, any):boolean**',
        'Check whether the first value is greater than the second value. Return true when the first value is more, or return false when less.',
      ],
      [IdentifierType.Any, IdentifierType.Any],
      IdentifierType.Boolean
    ),
    greaterOrEquals: createFunValDesc(
      [
        '**greaterOrEquals(any, any):boolean**',
        'Check whether the first value is greater than or equal to the second value. Return true when the first value is greater or equal, or return false when the first value is less.',
      ],
      [IdentifierType.Any, IdentifierType.Any],
      IdentifierType.Boolean
    ),
    if: createFunValDesc(
      [
        '**if(boolean, any, any):any**',
        'Check whether an expression is true or false. Based on the result, return a specified value.',
      ],
      [IdentifierType.Boolean, IdentifierType.Any, IdentifierType.Any],
      IdentifierType.Any
    ),
    less: createFunValDesc(
      [
        '**less(any, any):boolean**',
        'Check whether the first value is less than the second value. Return true when the first value is less, or return false when the first value is more.',
      ],
      [IdentifierType.Any, IdentifierType.Any],
      IdentifierType.Boolean
    ),
    lessOrEquals: createFunValDesc(
      [
        '**lessOrEquals(any, any):boolean**',
        'Check whether the first value is less than or equal to the second value. Return true when the first value is less than or equal, or return false when the first value is more.',
      ],
      [IdentifierType.Any, IdentifierType.Any],
      IdentifierType.Boolean
    ),
    not: createFunValDesc(
      [
        '**not(boolean):boolean**',
        'Check whether an expression is false. Return true when the expression is false, or return false when true.',
      ],
      [IdentifierType.Boolean],
      IdentifierType.Boolean
    ),
    or: createFunValDesc(
      [
        '**or(boolean, boolean):boolean**',
        'Check whether at least one expression is true. Return true when at least one expression is true, or return false when both are false.',
      ],
      [IdentifierType.Boolean, IdentifierType.Boolean],
      IdentifierType.Boolean
    ),
    //*********Math functions
    add: createFunValDesc(
      ['**add(number, number):number**', 'Return the result from adding two numbers.'],
      [IdentifierType.Number, IdentifierType.Number],
      IdentifierType.Number
    ),
    div: createFunValDesc(
      [
        '**div(number, number):number**',
        'Return the integer result from dividing two numbers. To get the remainder result, see mod().',
      ],
      [IdentifierType.Number, IdentifierType.Number],
      IdentifierType.Number
    ),
    max: createFunValDesc(
      [
        '**max(...number[]):number**',
        'Return the highest value from a list or array with numbers that is inclusive at both ends.',
      ],
      [IdentifierType.NumberArray],
      IdentifierType.Number
    ),
    min: createFunValDesc(
      ['**min(...number[]):number**', 'Return the lowest value from a set of numbers or an array.'],
      [IdentifierType.NumberArray],
      IdentifierType.Number
    ),
    mod: createFunValDesc(
      [
        '**mod(number, number):number**',
        'Return the remainder from dividing two numbers. To get the integer result, see div().',
      ],
      [IdentifierType.Number, IdentifierType.Number],
      IdentifierType.Number
    ),
    mul: createFunValDesc(
      ['**mul(number, number):number**', 'Return the product from multiplying two numbers.'],
      [IdentifierType.Number, IdentifierType.Number],
      IdentifierType.Number
    ),
    rand: createFunValDesc(
      [
        '**rand(number, number):number**',
        'Return a random integer from a specified range, which is inclusive only at the starting end.',
      ],
      [IdentifierType.Number, IdentifierType.Number],
      IdentifierType.Number
    ),
    range: createFunValDesc(
      ['**range(number, number):number**', 'Return an integer array that starts from a specified integer.'],
      [IdentifierType.Number, IdentifierType.Number],
      IdentifierType.NumberArray
    ),
    sub: createFunValDesc(
      ['**sub(number, number):number**', 'Return the result from subtracting the second number from the first number.'],
      [IdentifierType.Number, IdentifierType.Number],
      IdentifierType.Number
    ),
    //*********String functions
    concat: createFunValDesc(
      ['**concat(...string[]):string**', 'Combine two or more strings, and return the combined string.'],
      [IdentifierType.StringArrayList],
      IdentifierType.String
    ),
    endswith: createFunValDesc(
      [
        '**endswith(string, string):boolean**',
        'Check whether a string ends with a specific substring. Return true when the substring is found, or return false when not found. This function is not case-sensitive.',
      ],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.Boolean
    ),
    guid: createOverloadedFunValDesc(
      [
        '**guid():string**',
        '**guid(string):string**',
        'Check whether a string ends with a specific substring. Return true when the substring is found, or return false when not found. This function is not case-sensitive.',
      ],
      [[], [IdentifierType.String]],
      [IdentifierType.String, IdentifierType.String]
    ),
    indexOf: createFunValDesc(
      [
        '**indexOf(string, string):number**',
        'Return the starting position or index value for a substring. This function is not case-sensitive, and indexes start with the number 0.',
      ],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.Number
    ),
    lastIndexOf: createFunValDesc(
      [
        '**lastIndexOf(string, string):number**',
        'Return the starting position or index value for the last occurrence of a substring. This function is not case-sensitive, and indexes start with the number 0.',
      ],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.Number
    ),
    replace: createFunValDesc(
      [
        '**replace(string, string, string):string**',
        'Replace a substring with the specified string, and return the result string. This function is case-sensitive.',
      ],
      [IdentifierType.String, IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    split: createFunValDesc(
      [
        '**split(string, string):string[]**',
        'Return an array that contains substrings, separated by commas, based on the specified delimiter character in the original string.',
      ],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.StringArrayList
    ),
    startswith: createFunValDesc(
      [
        '**startswith(string, string):boolean**',
        'Check whether a string starts with a specific substring. Return true when the substring is found, or return false when not found. This function is not case-sensitive.',
      ],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.Boolean
    ),
    substring: createFunValDesc(
      [
        '**substring(string, number, number):string**',
        'Return characters from a string, starting from the specified position, or index. Index values start with the number 0.',
      ],
      [IdentifierType.String, IdentifierType.Number, IdentifierType.Number],
      IdentifierType.String
    ),
    toLower: createFunValDesc(
      [
        '**toLower(string):string**',
        "Return a string in lowercase format. If a character in the string doesn't have a lowercase version, that character stays unchanged in the returned string.",
      ],
      [IdentifierType.String],
      IdentifierType.String
    ),
    toUpper: createFunValDesc(
      [
        '**toUpper(string):string**',
        "Return a string in uppercase format. If a character in the string doesn't have an uppercase version, that character stays unchanged in the returned string.",
      ],
      [IdentifierType.String],
      IdentifierType.String
    ),
    trim: createFunValDesc(
      [
        '**trim(string):string**',
        'Remove leading and trailing whitespace from a string, and return the updated string.',
      ],
      [IdentifierType.String],
      IdentifierType.String
    )
  });

  static globalSymbolTable: SymbolTable;
  static globalValueDescriptionDict: ValueDescriptionDictionary;

  private constructor() {
  }
}
