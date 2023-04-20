import {CodeDocument} from "@monaco-imposture-tools/core";
import {AzLogicAppNode, SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME} from "./base";
import {
  AzLogicAppNodeUtils,
  AbstractReturnChainType,
  FunctionCallReturnChainType,
  IdentifierInBracketNotationReturnChainType,
  IdentifierReturnChainType,
  ReturnChainType,
  PrimitiveReturnChainType
} from "./azLgcNodesUtils";

export enum DescriptionType {
  FunctionValue = 0x101,
  OverloadedFunctionValue,
  ReferenceValue,
  PackageReference,
}

export interface IDescCollItem {
  type: 'basic' | 'emptyParaFunctionReturn' | 'overloadedFunction'
}

export class DescCollItem implements IDescCollItem {

  type = 'basic' as const;

  public constructor(
    public readonly vd: ValueDescription
  ) {
  }

  get isOptional() {
    return !!this.vd._$isOptional;
  }

  get isFunction() {
    return this.vd._$type === DescriptionType.FunctionValue
  }

  get areAllParaConstant(): boolean {
    return this.isFunction &&
      (this.vd as FunctionValueDescription)._$parameterTypes.length > 0 &&
      (this.vd as FunctionValueDescription)._$parameterTypes
        .every(value => value.type === IdentifierTypeName.CONSTANT);
  }

  get functionParameters() {
    if (this.isFunction) {
      return (this.vd as FunctionValueDescription)._$parameterTypes;
    }
    return [];
  }

}

export class EmptyParaRetDescCollItem implements IDescCollItem {

  type = 'emptyParaFunctionReturn' as const;

  constructor(
    public readonly funVd: FunctionValueDescription | OverloadedFunctionValueDescription,
    public readonly returnPath: ValueDescriptionPath[],
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

  get areAllParaConstant(): boolean {
    return this.overloadedFunVd._$parameterTypes[this.overloadedIndex].length > 0 &&
      this.overloadedFunVd._$parameterTypes[this.overloadedIndex].every(value =>
        value.type === IdentifierTypeName.CONSTANT
      )
  }

  get functionParameters() {
    return this.overloadedFunVd._$parameterTypes[this.overloadedIndex];
  }

}

export type DescCollItemTyp = DescCollItem | EmptyParaRetDescCollItem | OlFunDescCollItem

export interface DescriptorCollection<T extends ValueDescriptionPath[] = ValueDescriptionPath[]> {
  paths: T;
  valDescCollItem: DescCollItemTyp;
}


export enum IdentifierTypeName {
  UNRECOGNIZED = 0xfff,
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
  ARRAY_OF_TYPE,

  INTERNAL_PKG_REF,
  INTERNAL_FUN_REF,
  INTERNAL_OL_FUN_REF,
}

export class IdentifierType {

  // utils
  static populateVarParaIncreasingly(arr: IdentifierType[], varArgIndex: number) {
    if (varArgIndex < arr.length && arr[varArgIndex].isVarList) {
      arr.splice(varArgIndex, 0, arr[varArgIndex]);
    }
  }

  static interpretFunctionChainList(idChain: ReturnChainType[], retTyp: IdentifierType, funRetChainTyp: FunctionCallReturnChainType) {
    let interpretedChainList: Array<{
      path: string,
      retChainTyp: FunctionCallReturnChainType | IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType
    }> =
      retTyp.returnTypeChainList?.map(one => ({path: one, retChainTyp: funRetChainTyp})) || [];
    interpretedChainList = interpretedChainList.concat(
      (idChain.slice(1) as (IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType)[]).map(
        (oneRetTyp) => ({path: oneRetTyp.identifierName, retChainTyp: oneRetTyp})
      ) as any
    )
    return interpretedChainList;
  }

  // static constructors
  static UNRECOGNIZED = new IdentifierType(IdentifierTypeName.UNRECOGNIZED);
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
  static CONSTANT = (constantValue: string | number | boolean) => new IdentifierType(IdentifierTypeName.CONSTANT, {constantValue});
  static FUNCTION_RETURN_TYPE = (chainList: string[], returnTypeLabel = 'Return type') =>
    new IdentifierType(IdentifierTypeName.FUNCTION_RETURN_TYPE, {
      returnTypeChainList: [
        SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME, ...chainList
      ],
      returnTypeLabel
    });
  static ARRAY_OF_TYPE = (chainList: string[], arrayItemTypeLabel = 'Array item type') =>
    new IdentifierType(IdentifierTypeName.ARRAY_OF_TYPE, {
      arrayItemTypeChainList: [
        SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME, ...chainList
      ],
      arrayItemTypeLabel
    });

  static INTERNAL_PKG_REF = (packageDescription: PackageDescription) =>
    new IdentifierType(IdentifierTypeName.INTERNAL_PKG_REF, {packageDescription});
  static INTERNAL_FUN_REF = (functionValueDescription: FunctionValueDescription) =>
    new IdentifierType(IdentifierTypeName.INTERNAL_FUN_REF, {functionValueDescription});
  static INTERNAL_OL_FUN_REF = (overloadedFunctionValueDescription: OverloadedFunctionValueDescription) =>
    new IdentifierType(IdentifierTypeName.INTERNAL_OL_FUN_REF, {overloadedFunctionValueDescription});

  // CONSTANT
  public readonly constantValue?: string | number | boolean;
  // FUNCTION_RETURN_TYPE
  public readonly returnTypeChainList?: string[];
  public readonly returnTypeLabel?: string;
  // ARRAY_OF_TYPE
  public readonly arrayItemTypeChainList?: string[];
  public readonly arrayItemTypeLabel?: string;
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
      constantValue: string | number | boolean;
      // FUNCTION_RETURN_TYPE
      returnTypeChainList: string[];
      returnTypeLabel: string;
      // ARRAY_OF_TYPE
      arrayItemTypeChainList: string[];
      arrayItemTypeLabel: string;
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
        !(
          typeof option.constantValue === 'boolean' ||
          typeof option.constantValue === 'number' ||
          typeof option.constantValue === 'string')
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
    } else if (type === IdentifierTypeName.INTERNAL_PKG_REF) {
      if (!option.packageDescription) {
        new Error(`Incorrect internal package identifier: packageDescription missing`);
      }
    } else if (type === IdentifierTypeName.INTERNAL_FUN_REF) {
      if (!option.functionValueDescription) {
        new Error(`Incorrect internal function identifier: functionValueDescription missing`);
      }
    } else if (type === IdentifierTypeName.INTERNAL_OL_FUN_REF) {
      if (!option.overloadedFunctionValueDescription) {
        new Error(`Incorrect internal overloaded function identifier: overloadedFunctionValueDescription missing`);
      }
    }
    Object.assign(this, option);
  }

  get constantLabel(): string {
    if (this.type === IdentifierTypeName.CONSTANT) {
      return '' + this.constantValue;
    }
    return '';
  }

  get constantStringValue(): string {
    if (this.type === IdentifierTypeName.CONSTANT) {
      if (typeof this.constantValue === 'string') {
        return `'${this.constantValue}'`
      }
      return '' + this.constantValue;
    }
    return '';
  }


  get label(): string {
    switch (this.type) {
      case IdentifierTypeName.UNRECOGNIZED:
        return 'unknown';
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
        return this.returnTypeLabel || '';
      case IdentifierTypeName.ARRAY_OF_TYPE:
        return this.arrayItemTypeLabel || '';
      case IdentifierTypeName.INTERNAL_PKG_REF:
        return `package::${this.packageDescription?._$desc[0]}`
      case IdentifierTypeName.INTERNAL_FUN_REF:
        return `function::${this.functionValueDescription?._$desc[0]}`
      case IdentifierTypeName.INTERNAL_OL_FUN_REF:
        return `function::${this.overloadedFunctionValueDescription?._$desc[0]}`
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
      this.type === IdentifierTypeName.FUNCTION_RETURN_TYPE ||
      this.type === IdentifierTypeName.ARRAY_OF_TYPE
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
      this.type === IdentifierTypeName.NumberArray ||
      this.type === IdentifierTypeName.ARRAY_OF_TYPE
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
        case IdentifierTypeName.ARRAY_OF_TYPE:
        default:
          return [IdentifierType.Any, this];
      }
    } else {
      return [IdentifierType.Any, this];
    }
  }

  /**
   * assign source to target
   * @param target the identifier type of the target value
   * @param currentGlobalSymbolTable the global symbol table currently being used
   */
  assignableTo(target: IdentifierType | undefined, currentGlobalSymbolTable: SymbolTable): boolean {
    if (!this) return false;
    if (this === IdentifierType.UNRECOGNIZED) return false;
    if (!target) return false;
    if (target === IdentifierType.UNRECOGNIZED) return false;

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

    // for arrayList, azLgcExp support cast array into arraylist
    if (
      target === IdentifierType.StringArrayList &&
      (
        this === IdentifierType.String ||
        (this.type === IdentifierTypeName.CONSTANT && typeof this.constantValue === 'string') ||
        this === IdentifierType.StringArrayList ||
        (
          this.type === IdentifierTypeName.Any ||
          this.type === IdentifierTypeName.Array ||
          this.type === IdentifierTypeName.StringArray ||
          this.type === IdentifierTypeName.ARRAY_OF_TYPE
        )
      )
    ){
      return true;
    }

    if (
      target === IdentifierType.NumberArrayList &&
      (
        this === IdentifierType.Number ||
        (this.type === IdentifierTypeName.CONSTANT && typeof this.constantValue === 'number') ||
        this === IdentifierType.NumberArrayList ||
        (
          this.type === IdentifierTypeName.Any ||
          this.type === IdentifierTypeName.Array ||
          this.type === IdentifierTypeName.NumberArray ||
          this.type === IdentifierTypeName.ARRAY_OF_TYPE
        )
      )
    ) {
      return true;
    }

    if (
      target === IdentifierType.AnyObjectList &&
      (
        this === IdentifierType.AnyObject ||
        this === IdentifierType.XML ||
        this === IdentifierType.AnyObjectList ||
        this.isArray
      )
    ) {
      return true;
    }

    if (this.type === IdentifierTypeName.FUNCTION_RETURN_TYPE && target.type === IdentifierTypeName.FUNCTION_RETURN_TYPE) {
      return !!(this.returnTypeChainList?.length) &&
        this.returnTypeChainList.length === target.returnTypeChainList?.length &&
        this.returnTypeChainList.every((value, index) => (
          this.returnTypeChainList && target.returnTypeChainList &&
          this.returnTypeChainList[index] === target.returnTypeChainList[index]
        ))
    }

    if (this.type === IdentifierTypeName.FUNCTION_RETURN_TYPE) {
      // need to infer the return value of the function call, if it were `any`-like return true
      const retVd = currentGlobalSymbolTable.findByPath(this.returnTypeChainList || []);
      if (retVd) {
        // function returned types current could only be either PackageDescription or ReferenceValueDescription
        // thus we need not worry about FunctionValueDescription or OverloadedFunctionValueDescription
        if (retVd instanceof PackageDescription && retVd._$allowAdditionalAnyProperties) {
          return true;
        } else if (retVd instanceof ReferenceValueDescription && (
          retVd._$valueType === IdentifierType.Any ||
          retVd._$valueType === IdentifierType.AnyObject && target.isObject ||
          retVd._$valueType === IdentifierType.Array && target.isArray ||
          retVd._$valueType === IdentifierType.ArrayList ||
          (
            retVd._$valueType === IdentifierType.StringArrayList &&
            (this === IdentifierType.String || this === IdentifierType.StringArrayList)
          )
        )) {
          return true;
        }
      }
    }

    if (this.type === IdentifierTypeName.ARRAY_OF_TYPE && target.type === IdentifierTypeName.ARRAY_OF_TYPE) {
      return !!(this.arrayItemTypeChainList?.length) &&
        this.arrayItemTypeChainList.length === target.arrayItemTypeChainList?.length &&
        this.arrayItemTypeChainList.every((value, index) => (
          this.arrayItemTypeChainList && target.arrayItemTypeChainList &&
          this.arrayItemTypeChainList[index] === target.arrayItemTypeChainList[index]
        ))
    }

    if (this.type === IdentifierTypeName.CONSTANT && target.type === IdentifierTypeName.CONSTANT) {
      return this.constantValue === target.constantValue;
    }

    // azLgcExp allows string/number/boolean to be regarded as a constant and vice verse
    if (
      (this.type === IdentifierTypeName.String && target.type === IdentifierTypeName.CONSTANT && typeof target.constantValue === 'string') ||
      (this.type === IdentifierTypeName.Number && target.type === IdentifierTypeName.CONSTANT && typeof target.constantValue === 'number') ||
      (this.type === IdentifierTypeName.Boolean && target.type === IdentifierTypeName.CONSTANT && typeof target.constantValue === 'boolean')
    ) {
      return true;
    }

    if (
      (target.type === IdentifierTypeName.String && this.type === IdentifierTypeName.CONSTANT && typeof this.constantValue === 'string') ||
      (target.type === IdentifierTypeName.Number && this.type === IdentifierTypeName.CONSTANT && typeof this.constantValue === 'number') ||
      (target.type === IdentifierTypeName.Boolean && this.type === IdentifierTypeName.CONSTANT && typeof this.constantValue === 'boolean')
    ) {
      return true;
    }

    return this === target;
  }
}

export type ValueDescription =
  | FunctionValueDescription
  | OverloadedFunctionValueDescription
  | ReferenceValueDescription
  | PackageDescription;

export class ValueDescriptionPath {

  static buildPathString(paths: ValueDescriptionPath[]): string {
    let result = '';
    paths.forEach((value, index) => {
      if (value) {
        if (index === paths.length - 1) {
          result += value.name;
        } else {
          if (value.isOptional) {
            result += `${value.name}?.`
          } else {
            result += `${value.name}.`
          }
        }
      }
    })
    return result;
  }

  constructor(
    public readonly name: string,
    public readonly vd: ValueDescription
  ) {
  }

  get isOptional() {
    return this.vd._$isOptional;
  }

}

export abstract class AbstractValueDescription {

  protected constructor(
    public readonly _$type: DescriptionType,
    public readonly _$desc: string[],
    public readonly _$isOptional: boolean
  ) {
  }

  isUnrecognizedReference(): boolean {
    return this instanceof ReferenceValueDescription &&
      this._$valueType === IdentifierType.UNRECOGNIZED
  }

  get label() {
    if (this._$desc.length) {
      return this._$desc[0];
    }
    return '';
  }

  get descriptions() {
    if (this._$desc.length > 0) {
      return this._$desc.slice(1);
    }
    return [];
  }

  isInternal() {
    return this instanceof PackageDescription &&
      this._$isInternal;
  }

  abstract traverse(
    paths: ValueDescriptionPath[],
    cb: (paths: ValueDescriptionPath[], vd: ValueDescription) => void
  ): void;

  abstract collectAllPathBeneath(
    paths: ValueDescriptionPath[],
    collector: DescriptorCollection[]
  ): void;

}

export class FunctionValueDescription extends AbstractValueDescription {

  static buildOne(
    descStrings: string[],
    parameterTypes: IdentifierType[],
    returnType: IdentifierType,
    options: Partial<{
      optional: boolean
    }> = {}
  ): FunctionValueDescription {
    const funVd = new FunctionValueDescription(
      descStrings,
      !!options.optional,
      parameterTypes,
      returnType
    );
    funVd._$identifierType = IdentifierType.INTERNAL_FUN_REF(funVd);
    return funVd;
  }

  public _$type: typeof DescriptionType.FunctionValue;
  public _$identifierType: IdentifierType

  protected constructor(
    descStrings: string[],
    isOptional: boolean,
    public readonly _$parameterTypes: IdentifierType[],
    public readonly _$returnType: IdentifierType,
  ) {
    super(DescriptionType.FunctionValue, descStrings, isOptional)
  }

  traverse(paths: ValueDescriptionPath[], cb: (paths: ValueDescriptionPath[], vd: ValueDescription) => void) {
    cb(paths, this);
  }

  collectAllPathBeneath(
    paths: ValueDescriptionPath[],
    collector: DescriptorCollection[]
  ) {
    collector.push({
      paths: paths.slice(),
      valDescCollItem: new DescCollItem(this),
    });
  }
}

export const createFunValDesc = FunctionValueDescription.buildOne.bind(FunctionValueDescription) as typeof FunctionValueDescription.buildOne;


export class OverloadedFunctionValueDescription extends AbstractValueDescription {

  static buildOne(
    descStrings: string[],
    parameterTypes: IdentifierType[][],
    returnType: IdentifierType[],
    options: Partial<{
      optional: boolean
    }> = {}
  ): OverloadedFunctionValueDescription {
    if (parameterTypes.length !== returnType.length) {
      new Error(`Incorrect overloaded function description: the size of parameterTypes mismatches with returnType's`);
    }
    const olFunVd = new OverloadedFunctionValueDescription(
      descStrings,
      !!options.optional,
      parameterTypes,
      returnType
    );
    olFunVd._$identifierType = IdentifierType.INTERNAL_OL_FUN_REF(olFunVd);
    return olFunVd;
  }

  public _$type: typeof DescriptionType.OverloadedFunctionValue;
  public _$identifierType: IdentifierType

  protected constructor(
    descStrings: string[],
    isOptional: boolean,
    public readonly _$parameterTypes: IdentifierType[][],
    public readonly _$returnType: IdentifierType[]
  ) {
    super(DescriptionType.OverloadedFunctionValue, descStrings, isOptional)
  }

  traverse(paths: ValueDescriptionPath[], cb: (paths: ValueDescriptionPath[], vd: ValueDescription) => void) {
    cb(paths, this);
  }

  collectAllPathBeneath(
    paths: ValueDescriptionPath[],
    collector: DescriptorCollection[]
  ) {
    collector.push({
      paths: paths.slice(),
      valDescCollItem: new DescCollItem(this),
    });
  }

}

export const createOverloadedFunValDesc = OverloadedFunctionValueDescription.buildOne.bind(OverloadedFunctionValueDescription) as typeof OverloadedFunctionValueDescription.buildOne;


export class ReferenceValueDescription extends AbstractValueDescription {

  static buildOne(
    descStrings: string[],
    valueType: IdentifierType,
    optional?: boolean,
    value?: any
  ): ReferenceValueDescription {
    return new ReferenceValueDescription(
      descStrings,
      !!optional,
      valueType,
      value,
    );
  }

  public _$type: typeof DescriptionType.ReferenceValue;

  protected constructor(
    descStrings: string[],
    isOptional: boolean,
    public readonly _$valueType: IdentifierType,
    public readonly _$value?: any,
  ) {
    super(DescriptionType.ReferenceValue, descStrings, isOptional)
  }

  traverse(paths: ValueDescriptionPath[], cb: (paths: ValueDescriptionPath[], vd: ValueDescription) => void) {
    cb(paths, this);
  }

  collectAllPathBeneath(
    paths: ValueDescriptionPath[],
    collector: DescriptorCollection[]
  ) {
    collector.push({
      paths: paths.slice(),
      valDescCollItem: new DescCollItem(this),
    });
  }

}

export const createRefValDesc = ReferenceValueDescription.buildOne.bind(ReferenceValueDescription) as typeof ReferenceValueDescription.buildOne;

export class PackageDescription extends AbstractValueDescription {

  static CASE_MODE: 'CASE_SENSITIVE' | 'CASE_INSENSITIVE_WITH_WARNINGS' | 'CASE_INSENSITIVE' = 'CASE_INSENSITIVE_WITH_WARNINGS'

  static pathMatches(lPath: string, rPath: string): boolean {
    switch (PackageDescription.CASE_MODE) {
      case "CASE_INSENSITIVE":
      case "CASE_INSENSITIVE_WITH_WARNINGS":
        return lPath.toLowerCase() === rPath.toLowerCase();
      case "CASE_SENSITIVE":
      default:
        return lPath === rPath;
    }
  }

  static buildOne(
    descStrings: string[],
    subDescriptor: Record<string, ValueDescription>,
    options: Partial<{
      isInternal: boolean
      optional: boolean
      allowAdditionalAnyProperties: boolean
    }> = {}
  ): PackageDescription {
    const pkgDesc = new PackageDescription(
      descStrings,
      !!options.optional,
      Object.freeze(subDescriptor)
    );
    pkgDesc._$identifierType = IdentifierType.INTERNAL_PKG_REF(pkgDesc);
    pkgDesc._$isInternal = !!options.isInternal;
    pkgDesc._$allowAdditionalAnyProperties = !!options.allowAdditionalAnyProperties;
    return pkgDesc as PackageDescription;
  }

  public _$type: typeof DescriptionType.PackageReference;
  public _$identifierType: IdentifierType
  public _$isInternal = false;
  public _$allowAdditionalAnyProperties = false;

  private readonly _$subDescLowerCaseKeyMap: Map<string, string> = new Map();

  protected constructor(
    descStrings: string[],
    isOptional: boolean,
    private readonly _$subDescriptor: Record<string, ValueDescription>
  ) {
    super(DescriptionType.PackageReference, descStrings, isOptional)
    for (const [key] of this.iterator()) {
      this._$subDescLowerCaseKeyMap.set(key.toLocaleLowerCase(), key);
    }
  }

  traverse(paths: ValueDescriptionPath[], cb: (paths: ValueDescriptionPath[], vd: ValueDescription) => void) {
    for (const [key, value] of this.iterator()) {
      value.traverse([...paths, new ValueDescriptionPath(key, value)], cb);
    }
  }

  collectAllPathBeneath(
    paths: ValueDescriptionPath[],
    collector: DescriptorCollection[]
  ) {
    for (const [key, value] of this.iterator()) {
      value.collectAllPathBeneath([...paths, new ValueDescriptionPath(key, value)], collector);
    }
  }

  findAndCollectAllBeneath(
    paths: string[]
  ): DescriptorCollection[] {
    const collector: DescriptorCollection[] = [];
    const valueDescriptionPaths: ValueDescriptionPath[] = [];
    paths = paths.slice();
    let cur: ValueDescription | undefined = this as ValueDescription;
    if (paths.length) {
      let curPath = paths.shift();
      while (
        cur && curPath && cur instanceof PackageDescription && cur.has(curPath)
        ) {
        cur = cur.get(curPath);
        valueDescriptionPaths.push(new ValueDescriptionPath(curPath, cur!));
        curPath = paths.shift();
      }
    }
    if (
      cur
    ) {
      cur.collectAllPathBeneath(valueDescriptionPaths, collector);
    }
    return collector;
  }

  * iterator(): Generator<[string, ValueDescription], undefined, undefined> {
    for (const [key, value] of Object.entries(this._$subDescriptor)) {
      if (!key.startsWith('_$')) {
        yield [key, value];
      }
    }
    return
  }

  has(key: string): boolean {
    const caseSensitiveRes = key in this._$subDescriptor;
    const caseInSensitiveWithWarningsRes = caseSensitiveRes || this._$subDescLowerCaseKeyMap.has(key.toLowerCase());
    switch (PackageDescription.CASE_MODE) {
      case "CASE_INSENSITIVE":
      case "CASE_INSENSITIVE_WITH_WARNINGS":
        return caseInSensitiveWithWarningsRes;
      case "CASE_SENSITIVE":
      default:
        return caseSensitiveRes;
    }
  }

  getCaseSensitiveKeyIfExisted(key: string) {
    return this._$subDescLowerCaseKeyMap.has(key.toLowerCase()) ?
      this._$subDescLowerCaseKeyMap.get(key.toLowerCase())! :
      key;
  }

  get(key: string): ValueDescription | undefined {
    const caseSensitiveRes = this._$subDescriptor[key];
    const caseInSensitiveWithWarningsRes = !!caseSensitiveRes ?
      caseSensitiveRes :
      this._$subDescLowerCaseKeyMap.has(key.toLowerCase()) ?
        this._$subDescriptor[this._$subDescLowerCaseKeyMap.get(key.toLowerCase())!] :
        undefined;
    switch (PackageDescription.CASE_MODE) {
      case "CASE_INSENSITIVE":
      case "CASE_INSENSITIVE_WITH_WARNINGS":
        return caseInSensitiveWithWarningsRes;
      case "CASE_SENSITIVE":
      default:
        return caseSensitiveRes;
    }
  }

}

export const createPkgValDesc = PackageDescription.buildOne.bind(PackageDescription) as typeof PackageDescription.buildOne;

export function createFunRetDesc(desc: PackageDescription) {
  return {
    [SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME]: desc
  }
}

// export const EMPTY_VALUE_DESCRIPTION = createRefValDesc([], IdentifierType.Any);

export class VdWithSuggestionPath {

  constructor(
    public readonly vd: ValueDescription,
    public readonly path: string,
  ) {
  }
}

export class SymbolTable {

  static readonly emtpyFunRetTyp = createFunRetDesc(createPkgValDesc([], {}));
  static readonly globalSymbolTableBase = Object.freeze({

    // collection functions
    contains: createOverloadedFunValDesc(
      [
        '**contains(stringWithin:string, findString:string):boolean**',
        '**contains(arrayWithin:array, element:any):boolean**',
        '**contains(objectWithin:object, key:string):boolean**',
        'Check whether a collection has a specific item.',
      ],
      [
        [IdentifierType.String, IdentifierType.String],
        [IdentifierType.Any, IdentifierType.Any],
        [IdentifierType.AnyObject, IdentifierType.String],
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
        '**intersection(<collection1>\', \'<collection2>\', ...):object**',
        '**intersection([<collection1>], [<collection2>], ...):array**',
        'Returns a single array or object with the common elements between the arrays or objects passed to it. For example, this function returns [1, 2]: intersection([1, 2, 3], [101, 2, 1, 10],[6, 8, 1, 2]). The parameters for the function can either be a set of objects or a set of arrays (not a mixture thereof). If there are two objects with the same name, the last object with that name appears in the final object.',
      ],
      [
        [IdentifierType.AnyObjectList],
        [IdentifierType.ArrayList],
      ],
      [IdentifierType.AnyObject, IdentifierType.Array]
    ),
    join: createFunValDesc(
      [
        '**join(collection:any, delimiter:string):string**',
        'Return a string that has all the items from an array and has each character separated by a delimiter.',
      ],
      [IdentifierType.Any, IdentifierType.String],
      IdentifierType.String
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
    skip: createFunValDesc(
      [
        '**skip(collection:array, count:integer):array**',
        'Returns the elements in the array starting at index Count, for example this function returns [3, 4]: skip([1, 2 ,3 ,4], 2)',
      ],
      [IdentifierType.Array, IdentifierType.Number],
      IdentifierType.Array
    ),
    take: createOverloadedFunValDesc(
      [
        '**take(collection:array, count:number):array**',
        '**take(string:string, count:number):array**',
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
      [IdentifierType.Any],
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
    uriComponent: createFunValDesc(
      [
        '**uriComponent(string):string**',
        'Return a uniform resource identifier (URI) encoded version for a string by replacing URL-unsafe characters with escape characters. Use this function rather than encodeUriComponent(). Although both functions work the same way, uriComponent() is preferred.',
      ],
      [IdentifierType.String],
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
        '**xpath(xml:any, xpath:any):any**',
        'Check XML for nodes or values that match an XPath (XML Path Language) expression, and return the matching nodes or values. An XPath expression, or just "XPath", helps you navigate an XML document structure so that you can select nodes or compute values in the XML content.',
      ],
      [IdentifierType.Any, IdentifierType.Any],
      IdentifierType.Any
    ),
    //*********date functions
    addToTime: createOverloadedFunValDesc(
      [
        '**addToTime(timestamp:string, interval:number, timeUnit:string):string**',
        '**addToTime(timestamp:string, interval:number, timeUnit:string, format:string):string**',
        'Add a number of time units to a timestamp. '
      ],
      [
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String, IdentifierType.String]
      ],
      [
        IdentifierType.String,
        IdentifierType.String
      ]
    ),
    addDays: createOverloadedFunValDesc(
      [
        '**addDays(timestamp:string, days:number):string**',
        '**addDays(timestamp:string, days:number, format:string):string**',
        'Add a number of days to a timestamp.'
      ],
      [
        [IdentifierType.String, IdentifierType.Number],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    addHours: createOverloadedFunValDesc(
      [
        '**addHours(timestamp:string, hours:number):string**',
        '**addHours(timestamp:string, hours:number, format:string):string**',
        'Add a number of hours to a timestamp.'
      ],
      [
        [IdentifierType.String, IdentifierType.Number],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    addMinutes: createOverloadedFunValDesc(
      [
        '**addMinutes(timestamp:string, minutes:number):string**',
        '**addMinutes(timestamp:string, minutes:number, format:string):string**',
        'Add a number of minutes to a timestamp.'
      ],
      [
        [IdentifierType.String, IdentifierType.Number],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    addSeconds: createOverloadedFunValDesc(
      [
        '**addSeconds(timestamp:string, seconds:number):string**',
        '**addSeconds(timestamp:string, seconds:number, format:string):string**',
        'Add a number of seconds to a timestamp.'
      ],
      [
        [IdentifierType.String, IdentifierType.Number],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    convertFromUtc: createOverloadedFunValDesc(
      [
        '**convertFromUtc(timestamp:string, destinationTimeZone:string):string**',
        '**convertFromUtc(timestamp:string, destinationTimeZone:string, format:string):string**',
        'Convert a timestamp from Universal Time Coordinated (UTC) to the target time zone.',
      ],
      [
        [IdentifierType.String, IdentifierType.String],
        [IdentifierType.String, IdentifierType.String, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    convertTimeZone: createOverloadedFunValDesc(
      [
        '**convertTimeZone(timestamp:string, sourceTimeZone:string, destinationTimeZone:string):string**',
        '**convertTimeZone(timestamp:string, sourceTimeZone:string, destinationTimeZone:string, format:string):string**',
        'Convert a timestamp from the source time zone to the target time zone.',
      ],
      [
        [IdentifierType.String, IdentifierType.String, IdentifierType.String],
        [IdentifierType.String, IdentifierType.String, IdentifierType.String, IdentifierType.String],
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    convertToUtc: createOverloadedFunValDesc(
      [
        '**convertToUtc(timestamp:string, sourceTimeZone:string):string**',
        '**convertToUtc(timestamp:string, sourceTimeZone:string, format:string):string**',
        'Convert a timestamp from the source time zone to Universal Time Coordinated (UTC).',
      ],
      [
        [IdentifierType.String, IdentifierType.String],
        [IdentifierType.String, IdentifierType.String, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
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
    formatDateTime: createOverloadedFunValDesc(
      [
        '**formatDateTime(Date:string):string**',
        '**formatDateTime(Date:string, Format:string):string**',
        'Return a timestamp in the specified format.'
      ],
      [
        [IdentifierType.String],
        [IdentifierType.String, IdentifierType.String],
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    getFutureTime: createOverloadedFunValDesc(
      [
        '**getFutureTime(interval:number, timeUnit:string):string**',
        '**getFutureTime(interval:number, timeUnit:string, format:string):string**',
        'Return the current timestamp plus the specified time units.',
      ],
      [
        [IdentifierType.Number, IdentifierType.String],
        [IdentifierType.Number, IdentifierType.String, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    getPastTime: createOverloadedFunValDesc(
      [
        '**getPastTime(interval:number, timeUnit:string):string**',
        '**getPastTime(interval:number, timeUnit:string, format:string):string**',
        'Return the current timestamp minus the specified time units.',
      ],
      [
        [IdentifierType.Number, IdentifierType.String],
        [IdentifierType.Number, IdentifierType.String, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    startOfDay: createOverloadedFunValDesc(
      [
        '**startOfDay(timestamp:string):string**',
        '**startOfDay(timestamp:string, format:string):string**',
        'Return the start of the day for a timestamp.'
      ],
      [
        [IdentifierType.String],
        [IdentifierType.String, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    startOfHour: createOverloadedFunValDesc(
      [
        '**startOfHour(timestamp:string):string**',
        '**startOfHour(timestamp:string, format:string):string**',
        'Return the start of the hour for a timestamp.'
      ],
      [
        [IdentifierType.String],
        [IdentifierType.String, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    startOfMonth: createOverloadedFunValDesc(
      [
        '**startOfMonth(timestamp:string):string**',
        '**startOfMonth(timestamp:string, format:string):string**',
        'Return the start of the month for a timestamp.'
      ],
      [
        [IdentifierType.String],
        [IdentifierType.String, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    subtractFromTime: createOverloadedFunValDesc(
      [
        '**subtractFromTime(timestamp:string, interval:integer, timeUnit:string):string**',
        '**subtractFromTime(timestamp:string, interval:integer, timeUnit:string, format:string):string**',
        'Subtract a number of time units from a timestamp. See also getPastTime.',
      ],
      [
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String, IdentifierType.String]
      ],
      [IdentifierType.String, IdentifierType.String]
    ),
    ticks: createFunValDesc(
      [
        '**ticks(timestamp:string):Integer**',
        'Return the ticks property value for a specified timestamp. A tick is a 100-nanosecond interval.',
      ],
      [IdentifierType.String],
      IdentifierType.Number
    ),
    utcNow: createOverloadedFunValDesc(
      [
        '**utcNow():string**',
        '**utcNow(format:string):string**',
        'Return the current timestamp.'
      ],
      [[], [IdentifierType.String]],
      [IdentifierType.String, IdentifierType.String]
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
        '**if(expression:boolean, trueResult:any, falseResult:any):any**',
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
        '**div(dividend:number, divisor:number):number**',
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
      [IdentifierType.NumberArrayList],
      IdentifierType.Number
    ),
    min: createFunValDesc(
      ['**min(...number[]):number**', 'Return the lowest value from a set of numbers or an array.'],
      [IdentifierType.NumberArrayList],
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
        '**rand(minimum:number, maximum:number):number**',
        'Return a random integer from a specified range, which is inclusive only at the starting end.',
      ],
      [IdentifierType.Number, IdentifierType.Number],
      IdentifierType.Number
    ),
    range: createFunValDesc(
      ['**range(startIndex:number, count:number):number[]**', 'Return an integer array that starts from a specified integer.'],
      [IdentifierType.Number, IdentifierType.Number],
      IdentifierType.NumberArray
    ),
    sub: createFunValDesc(
      ['**sub(minuend:number, subtrahend:number):number**', 'Return the result from subtracting the second number from the first number.'],
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
        '**endswith(string:string, endString:string):boolean**',
        'Check whether a string ends with a specific substring. Return true when the substring is found, or return false when not found. This function is not case-sensitive.',
      ],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.Boolean
    ),
    guid: createOverloadedFunValDesc(
      [
        '**guid():string**',
        '**guid(format:string):string**',
        'Check whether a string ends with a specific substring. Return true when the substring is found, or return false when not found. This function is not case-sensitive.',
      ],
      [[], [IdentifierType.String]],
      [IdentifierType.String, IdentifierType.String]
    ),
    indexOf: createFunValDesc(
      [
        '**indexOf(string:string, searchString:string):number**',
        'Return the starting position or index value for a substring. This function is not case-sensitive, and indexes start with the number 0.',
      ],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.Number
    ),
    lastIndexOf: createFunValDesc(
      [
        '**lastIndexOf(string:string, searchString:string):number**',
        'Return the starting position or index value for the last occurrence of a substring. This function is not case-sensitive, and indexes start with the number 0.',
      ],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.Number
    ),
    replace: createFunValDesc(
      [
        '**replace(string:string, oldString:string, newString:string):string**',
        'Replace a substring with the specified string, and return the result string. This function is case-sensitive.',
      ],
      [IdentifierType.String, IdentifierType.String, IdentifierType.String],
      IdentifierType.String
    ),
    split: createFunValDesc(
      [
        '**split(string:string, separator:string):string[]**',
        'Return an array that contains substrings, separated by commas, based on the specified delimiter character in the original string.',
      ],
      [IdentifierType.String, IdentifierType.String],
      IdentifierType.StringArrayList
    ),
    startswith: createFunValDesc(
      [
        '**startswith(string:string, startString:string):boolean**',
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

  private readonly rootPkgDesc: PackageDescription;
  private readonly funRetPkgDesc: PackageDescription;
  private readonly funRetPkgDescPath: ValueDescriptionPath;

  static buildOne(
    base: Record<string, ValueDescription>,
    funRetTyp: { [SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME]: PackageDescription } = SymbolTable.emtpyFunRetTyp
  ) {
    return new SymbolTable(base, funRetTyp);
  }

  static isValueDescriptor(node: any) {
    return (
      node instanceof AbstractValueDescription &&
      node?._$type &&
      (node._$type === DescriptionType.FunctionValue ||
        node._$type === DescriptionType.OverloadedFunctionValue ||
        node._$type === DescriptionType.PackageReference ||
        node._$type === DescriptionType.ReferenceValue)
    );
  }

  static covertCollectedPathsIntoString(collectedPaths: string[]): string {
    return collectedPaths.filter(Boolean)
      .filter(one => (one !== SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME))
      .join('.')
  }

  // static traverseDescriptor(
  //   descriptor: ValueDescription,
  //   paths: string[],
  //   cb: (paths: string[], vd: ValueDescription) => void
  // ){
  //   paths = paths.slice();
  //   if (this.isValueDescriptor(descriptor)) {
  //     descriptor.traverse(paths, cb);
  //   }
  //   return;
  // }

  protected constructor(
    base: Record<string, ValueDescription>,
    funRetTyp: { [SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME]: PackageDescription } = SymbolTable.emtpyFunRetTyp
  ) {
    this.rootPkgDesc = createPkgValDesc([], {
      ...SymbolTable.globalSymbolTableBase,
      ...base,
    });
    this.rootPkgDesc._$isInternal = true;
    this.funRetPkgDesc = funRetTyp[SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME];
    this.funRetPkgDesc._$isInternal = true;

    this.funRetPkgDescPath = new ValueDescriptionPath(SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME, this.funRetPkgDesc);
  }

  findByPath(paths: string[]): ValueDescription | undefined {
    if (!paths.length) return;
    paths = paths.slice();

    const firstPath = paths.shift();
    if (!firstPath) return;
    let valDesc: ValueDescription | undefined = undefined;
    if (firstPath === SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME && this.funRetPkgDesc) {
      valDesc = this.funRetPkgDesc;
    } else {
      valDesc = this.rootPkgDesc.get(firstPath);
    }

    if (!valDesc) return;

    let cur: ValueDescription | undefined = valDesc;
    let curPath = paths.shift();
    while (cur && curPath && cur instanceof PackageDescription) {
      cur = cur.get(curPath);
      curPath = paths.shift();
    }
    if (SymbolTable.isValueDescriptor(cur)) {
      if (cur instanceof ReferenceValueDescription) {
        if (cur._$valueType.isAnyObject) {
          return cur;
        }
      }
      if (paths.length === 0) return cur;
    }
    return;
  }

  findAllByPath(paths: string[]): ValueDescriptionPath[] {
    const valDescPathArr: ValueDescriptionPath[] = [];
    if (!paths.length) return valDescPathArr;
    paths = paths.slice();

    let firstPath = paths.shift()!;
    if (!firstPath) return valDescPathArr;
    let valDesc: ValueDescription | undefined = undefined;
    if (firstPath === SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME && this.funRetPkgDesc) {
      valDesc = this.funRetPkgDesc;
    } else {
      if (
        PackageDescription.CASE_MODE === 'CASE_INSENSITIVE_WITH_WARNINGS' ||
        PackageDescription.CASE_MODE === 'CASE_INSENSITIVE'
      ) {
        firstPath = this.rootPkgDesc.getCaseSensitiveKeyIfExisted(firstPath);
      }
      valDesc = this.rootPkgDesc.get(firstPath);
    }

    if (!valDesc) return valDescPathArr;

    let cur: ValueDescription | undefined = valDesc;
    valDescPathArr.push(
      firstPath === SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME ?
        this.funRetPkgDescPath :
        new ValueDescriptionPath(firstPath, valDesc)
    );
    let curPath = paths.shift();
    while (cur && curPath && cur instanceof PackageDescription) {
      if (
        PackageDescription.CASE_MODE === 'CASE_INSENSITIVE_WITH_WARNINGS' ||
        PackageDescription.CASE_MODE === 'CASE_INSENSITIVE'
      ) {
        curPath = cur.getCaseSensitiveKeyIfExisted(curPath);
      }
      cur = cur.get(curPath);
      if (cur) {
        valDescPathArr.push(new ValueDescriptionPath(curPath, cur));
        curPath = paths.shift();
      }
    }
    if (SymbolTable.isValueDescriptor(cur)) {
      if (cur instanceof ReferenceValueDescription) {
        if (cur._$valueType.isAnyObject) {
          return valDescPathArr;
        }
      }
      if (paths.length === 0) return valDescPathArr;
    }
    return [];
  }


  * iterateByRetChainTyp(codeDocument: CodeDocument)
    : Generator<ValueDescriptionPath, undefined,
    FunctionCallReturnChainType | IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType | undefined> {
    const collectedPaths: string[] = [];
    let cur: ValueDescription | undefined = this.rootPkgDesc as ValueDescription;
    let nextRetChainType = yield new ValueDescriptionPath('', cur);
    if (!nextRetChainType) return;
    collectedPaths.push(nextRetChainType.label)
    while (cur && nextRetChainType) {
      if (!SymbolTable.isValueDescriptor(cur)) return;
      if (cur instanceof ReferenceValueDescription && cur._$valueType.isAnyObject) {
        // terminal any type
        nextRetChainType = yield new ValueDescriptionPath(
          nextRetChainType.label,
          createRefValDesc([
            `${SymbolTable.covertCollectedPathsIntoString(collectedPaths)}:any`
          ], IdentifierType.Any)
        );
      } else if (
        nextRetChainType instanceof IdentifierInBracketNotationReturnChainType &&
        cur instanceof ReferenceValueDescription &&
        cur._$valueType.type === IdentifierTypeName.ARRAY_OF_TYPE
      ) {
        const literalArrayContent = codeDocument.getNodeContent(nextRetChainType.node);
        const arrayItemTypeChainList = cur._$valueType.arrayItemTypeChainList!;
        cur = this.findByPath(arrayItemTypeChainList);
        if (!cur) {
          // todo enhance this err clazz
          throw new Error(`Cannot find ARRAY_OF_TYPE vd of ${arrayItemTypeChainList.join('.')}`)
        }
        nextRetChainType = yield new ValueDescriptionPath(literalArrayContent, cur);
        collectedPaths.push(literalArrayContent || '');
      } else if (
        nextRetChainType instanceof FunctionCallReturnChainType
      ) {
        // only the first item of the retChain could be of the FunctionCallReturnChainType, otherwise it would be a flaw
        if (cur !== this.rootPkgDesc) return
        const functionFullName = nextRetChainType.functionFullName;
        const theFunDescPaths = this.findAllByPath(functionFullName.split('.'));
        if (theFunDescPaths.length) {
          const functionFullNameCodes = ValueDescriptionPath.buildPathString(
            theFunDescPaths.filter(one => one.name !== SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME)
          );
          const retTyp: IdentifierType | undefined = this.determineReturnIdentifierTypeOfFunction(
            codeDocument,
            nextRetChainType.node as any,
            theFunDescPaths[theFunDescPaths.length - 1].vd
          );
          if (retTyp) {
            if (retTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE && retTyp.returnTypeChainList?.length) {
              cur = this.findByPath(retTyp.returnTypeChainList);
              if (!cur) {
                // todo enhance this err clazz
                throw new Error(`Cannot find FUNCTION_RETURN_TYPE vd of ${retTyp.returnTypeChainList.join('.')}`)
              }
            } else {
              cur = createRefValDesc(
                [`Return value of ${functionFullName}`],
                retTyp
              );
            }
            nextRetChainType = yield new ValueDescriptionPath(functionFullNameCodes, cur);
            collectedPaths.push(functionFullNameCodes || '');
            continue;
          } else {
            return;
          }
        } else {
          return;
        }
      } else if (
        (
          nextRetChainType instanceof IdentifierInBracketNotationReturnChainType ||
          nextRetChainType instanceof IdentifierReturnChainType
        ) &&
        cur instanceof PackageDescription
      ) {
        let found = false;
        let identifierName = nextRetChainType.identifierName;
        if (!(cur.has(identifierName)) && cur._$allowAdditionalAnyProperties) {
          cur = createRefValDesc([
            `${SymbolTable.covertCollectedPathsIntoString(collectedPaths)}:any`
          ], IdentifierType.Any);
          found = true;
        } else {
          if (
            PackageDescription.CASE_MODE === 'CASE_INSENSITIVE_WITH_WARNINGS' ||
            PackageDescription.CASE_MODE === 'CASE_INSENSITIVE'
          ) {
            identifierName = cur.getCaseSensitiveKeyIfExisted(identifierName);
          }
          cur = cur.get(identifierName);
          if (cur) {
            found = true;
          }
        }
        if (found) {
          nextRetChainType = yield new ValueDescriptionPath(identifierName, cur!);
          collectedPaths.push(identifierName || '');
        } else {
          return;
        }
      } else {
        // no way to continue
        return
      }
    }
    return
  }

  generateValueDescriptionDictionary(): ValueDescriptionDictionary {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const curSymbolTable = this;
    const result: ValueDescriptionDictionary = new Map<IdentifierType | string, DescriptorCollection[]>([
      [ValueDescriptionDictionaryFunctionKey, []],
      [IdentifierType.Any, []],
      [IdentifierType.Boolean, []],
      [IdentifierType.String, []],
      [IdentifierType.Number, []],
      [IdentifierType.AnyObject, []],
      [IdentifierType.Array, []],
      [IdentifierType.StringArray, []],
      [IdentifierType.NumberArray, []],
      [IdentifierType.Null, []],
      [IdentifierType.XML, []],
      [IdentifierType.ArrayList, []],
      [IdentifierType.StringArrayList, []],
      [IdentifierType.NumberArrayList, []],
      [IdentifierType.AnyObjectList, []],
    ]);

    function saveToDescriptionDictionary(paths: ValueDescriptionPath[], vd: ValueDescription) {
      if (paths.some(one => one.vd.isInternal())) return;
      switch (vd._$type) {
        case DescriptionType.FunctionValue:
          if (vd._$returnType.type === IdentifierTypeName.FUNCTION_RETURN_TYPE) {
            const dynamicReturnType = vd._$returnType;
            const targetResult = (
              result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []
            ) as DescriptorCollection[];
            result.set(dynamicReturnType, targetResult);
            targetResult.push({
              paths,
              valDescCollItem: new DescCollItem(vd),
            });
            if (
              vd._$parameterTypes.length === 0 &&
              vd._$returnType.returnTypeChainList?.length &&
              vd._$returnType.returnTypeChainList[0] === SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME
            ) {
              // alright we gotta empty para function returning obj type and need to populate its children to the completion list
              // first find the return descriptor
              const retValDesc = curSymbolTable.findByPath(vd._$returnType.returnTypeChainList);
              // if the return description existed, we could populate items traversing the description
              if (retValDesc) {
                retValDesc.traverse([], (rtPaths, rtVd) => {
                  if (rtVd instanceof ReferenceValueDescription) {
                    if (rtVd._$valueType.type === IdentifierTypeName.OBJECT) {
                      const dynamicReturnType = rtVd._$valueType;
                      const targetResult = (
                        result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []
                      ) as DescriptorCollection[];
                      result.set(dynamicReturnType, targetResult);
                      targetResult.push({
                        paths,
                        valDescCollItem: new EmptyParaRetDescCollItem(vd, rtPaths, rtVd),
                      });
                    } else {
                      result.get(rtVd._$valueType)!.push({
                        paths,
                        valDescCollItem: new EmptyParaRetDescCollItem(vd, rtPaths, rtVd),
                      });
                    }
                  }
                });
              }
            }
          } else {
            result.get(vd._$returnType)!.push({
              paths,
              valDescCollItem: new DescCollItem(vd),
            });
          }
          result.get(ValueDescriptionDictionaryFunctionKey)!.push({
            paths,
            valDescCollItem: new DescCollItem(vd),
          });
          break;
        case DescriptionType.OverloadedFunctionValue:
          vd._$returnType.forEach((oneReturnType, olRtIndex) => {
            if (oneReturnType.type === IdentifierTypeName.FUNCTION_RETURN_TYPE) {
              const dynamicReturnType = oneReturnType;
              const targetResult = (
                result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []
              ) as DescriptorCollection[];
              result.set(dynamicReturnType, targetResult);
              targetResult.push({
                paths,
                valDescCollItem: new OlFunDescCollItem(vd, olRtIndex),
              });
              if (
                vd._$parameterTypes[olRtIndex].length === 0 &&
                vd._$returnType[olRtIndex].returnTypeChainList?.length &&
                vd._$returnType[olRtIndex].returnTypeChainList![0] === SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME
              ) {
                // alright, among an overload function, we gotta empty para function returning obj type and need to populate its children to the completion list
                // first find the return descriptor
                const retValDesc = curSymbolTable.findByPath(
                  vd._$returnType[olRtIndex].returnTypeChainList!
                );
                // if the return description existed, we could populate items traversing the description
                if (retValDesc) {
                  retValDesc.traverse([], (olRtPaths, olRtVd) => {
                    if (olRtVd._$type === DescriptionType.ReferenceValue) {
                      if (olRtVd._$valueType.type === IdentifierTypeName.OBJECT) {
                        const dynamicReturnType = olRtVd._$valueType;
                        const targetResult = (
                          result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []
                        ) as DescriptorCollection[];
                        result.set(dynamicReturnType, targetResult);
                        targetResult.push({
                          paths,
                          valDescCollItem: new EmptyParaRetDescCollItem(vd, olRtPaths, olRtVd, olRtIndex),
                        });
                      } else {
                        result.get(olRtVd._$valueType)!.push({
                          paths,
                          valDescCollItem: new EmptyParaRetDescCollItem(vd, olRtPaths, olRtVd, olRtIndex),
                        });
                      }
                    }
                  });
                }
              }
            } else {
              result.get(oneReturnType)!.push({
                paths,
                valDescCollItem: new OlFunDescCollItem(vd, olRtIndex),
              });
            }
            result.get(ValueDescriptionDictionaryFunctionKey)!.push({
              paths,
              valDescCollItem: new OlFunDescCollItem(vd, olRtIndex),
            });
          });
          break;
        case DescriptionType.ReferenceValue:
          if (vd._$valueType.isComposite) {
            const dynamicReturnType = vd._$valueType;
            const targetResult = (
              result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []
            ) as DescriptorCollection[];
            result.set(dynamicReturnType, targetResult);
            targetResult.push({
              paths,
              valDescCollItem: new DescCollItem(vd),
            });
          } else {
            result.get(vd._$valueType)!.push({
              paths,
              valDescCollItem: new DescCollItem(vd),
            });
          }
          break;
        case DescriptionType.PackageReference:
          // we should never reach over here, but no harm to add it
          break;
      }
    }

    // traverseDescriptor(descriptor._$functionReturnType, ['_$functionReturnType'], saveToDescriptionDictionary)
    this.rootPkgDesc.traverse([], saveToDescriptionDictionary);
    this.funRetPkgDesc.traverse([this.funRetPkgDescPath], saveToDescriptionDictionary);

    return result;
  }

  findAllRootPackage(): DescriptorCollection<[ValueDescriptionPath]>[] {
    const collector: DescriptorCollection<[ValueDescriptionPath]>[] = [];
    if (this.rootPkgDesc && this.rootPkgDesc instanceof PackageDescription) {
      for (const [key, vd] of this.rootPkgDesc.iterator()) {
        if (!key.startsWith('_$') && SymbolTable.isValueDescriptor(vd)) {
          switch (vd._$type) {
            case DescriptionType.OverloadedFunctionValue:
              vd._$parameterTypes.forEach((_val, index) => {
                collector.push({
                  paths: [new ValueDescriptionPath(key, vd)],
                  valDescCollItem: new OlFunDescCollItem(vd, index),
                });
              });
              break;
            case DescriptionType.FunctionValue:
            case DescriptionType.PackageReference:
            case DescriptionType.ReferenceValue:
              // todo populate empty para fun return refs
              collector.push({
                paths: [new ValueDescriptionPath(key, vd)],
                valDescCollItem: new DescCollItem(vd),
              });
              break;
          }
        }
      }
    }
    return collector;
  }

  findAndCollectAllBeneath(
    paths: string[]
  ): DescriptorCollection[] {
    if (paths.length && paths[0] === SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME) {
      const res = this.funRetPkgDesc.findAndCollectAllBeneath(paths.slice(1));
      res.forEach(value => {
        value.paths.unshift(this.funRetPkgDescPath);
      })
      return res;
    } else {
      return this.rootPkgDesc.findAndCollectAllBeneath(paths);
    }
  }

  inferIdentifierTypeFromChain(
    codeDocument: CodeDocument,
    idChain: ReturnChainType[]
  ): IdentifierType | undefined {

    const vd = this.findValueDescriptionFromChain(codeDocument, idChain);
    if (vd) {
      if (
        vd instanceof FunctionValueDescription ||
        vd instanceof OverloadedFunctionValueDescription ||
        vd instanceof PackageDescription
      ) {
        return vd._$identifierType;
      } else {
        return vd._$valueType
      }
    }
    if (idChain.length === 1) {
      // return constant type instead
      if (idChain[0] instanceof PrimitiveReturnChainType) {
        switch (idChain[0].type) {
          case 'number': {
            let theDecimalValue: number | undefined = undefined;
            try {
              theDecimalValue = +idChain[0].constantValueString;
            } catch (e) {
              // noop
            }
            if (typeof theDecimalValue === 'number') {
              return IdentifierType.CONSTANT(theDecimalValue);
            }
            break;
          }
          case 'string': {
            const theStringValue: string | undefined = idChain[0].constantValueString;
            if (typeof theStringValue === 'string' && theStringValue[0] === "'" && theStringValue[theStringValue.length - 1] === "'") {
              return IdentifierType.CONSTANT(theStringValue.slice(1, theStringValue.length - 1));
            }
            break;
          }
          case 'boolean': {
            const theBooleanValueString: string | undefined = idChain[0].constantValueString;
            if (theBooleanValueString === 'true') {
              return IdentifierType.CONSTANT(true);
            } else if (theBooleanValueString === 'false') {
              return IdentifierType.CONSTANT(false);
            }
            break
          }
        }
      }
      switch (idChain[0].type) {
        case 'number':
          return IdentifierType.Number;
        case 'string':
          return IdentifierType.String;
        case 'boolean':
          return IdentifierType.Boolean;
        case 'null':
          return IdentifierType.Null;
        case 'array-literal':
          return IdentifierType.Array;
      }
    }
    return;
  }

  determineOverloadFunParamSeq(
    codeDocument: CodeDocument,
    funNode: AzLogicAppNode,
    funVd: ValueDescription
  ): number {
    if (
      funNode.$impostureLang?.dataType === 'function-call-complete' &&
      funNode.children?.length &&
      funNode.children[0].$impostureLang?.dataType === 'function-call' &&
      funNode.children[1].$impostureLang?.dataType === 'parentheses' &&
      funVd._$type === DescriptionType.OverloadedFunctionValue
    ) {
      const parenthesesNode = funNode.children[1];
      // ensure we duplicate another array of the para list
      let curParaCandidates = funVd._$parameterTypes // paraTypes appended w/ an index
        .map((value, index) => [...value, index as unknown as IdentifierType]);
      const commaIndices = AzLogicAppNodeUtils.listCommaIndicesOfParenthesesChildren(
        parenthesesNode.children as AzLogicAppNode[] | undefined
      );
      const curParaSize = commaIndices.length === 0 ?
        (parenthesesNode.children?.length || 0) > 0 ? 1 : 0 :
        commaIndices.length + 1;
      // check para size
      const sizeMatchingParaCandidates = curParaCandidates.filter(
        (value) => value.length - 1 === curParaSize
      );

      // noop there would be var list args
      // no if (!curParaCandidates.length) return 0;
      if (sizeMatchingParaCandidates.length === 1)
        return sizeMatchingParaCandidates[0][sizeMatchingParaCandidates[0].length - 1] as unknown as number;

      if (parenthesesNode.children?.length) {
        // check para type one by one
        commaIndices.unshift(0);
        commaIndices.push(parenthesesNode.children.length - 1);
        // iterate, seize and validate param return type
        let paraIndex = 0;
        while (paraIndex < commaIndices.length - 1) {
          const oneParaNode =
            paraIndex === 0
              ? parenthesesNode.children[commaIndices[paraIndex]]
              : parenthesesNode.children[commaIndices[paraIndex]].findAYoungerSibling();
          if (oneParaNode) {
            const oneIdChain = AbstractReturnChainType.findCompleteForwardIdentifiersChain(oneParaNode as any, codeDocument);
            const sourceIdTyp = this.inferIdentifierTypeFromChain(codeDocument, oneIdChain.chain);
            curParaCandidates = curParaCandidates.filter((value) => {
              if (paraIndex < value.length - 1) {
                if (value[paraIndex].isVarList) {
                  IdentifierType.populateVarParaIncreasingly(value, paraIndex);
                }
                const targetIdTyp = value[paraIndex];
                return (
                    targetIdTyp.type === IdentifierTypeName.CONSTANT &&
                    targetIdTyp.constantStringValue === codeDocument.getNodeContent(oneParaNode)
                  ) ||
                  sourceIdTyp?.assignableTo(targetIdTyp, this);
              }
              return false;
            });
          } else {
            // unexpected tokens found
            break;
          }
          paraIndex++;
        }
        if (!curParaCandidates.length) return 0;
        return curParaCandidates[0][curParaCandidates[0].length - 1] as unknown as number;
      }
    }
    // return the first para if no candidate found
    return 0;
  }

  determineReturnIdentifierTypeOfFunction(
    codeDocument: CodeDocument,
    funNode: AzLogicAppNode,
    functionValueDescription: ValueDescription
  ): IdentifierType | undefined {
    let retTyp: IdentifierType | undefined = undefined;
    if (functionValueDescription._$type === DescriptionType.FunctionValue) {
      // regular function
      retTyp = functionValueDescription._$returnType;
    } else if (functionValueDescription._$type === DescriptionType.OverloadedFunctionValue) {
      // overloaded function
      const paramIndex = this.determineOverloadFunParamSeq(codeDocument, funNode, functionValueDescription);
      if (paramIndex < functionValueDescription._$returnType.length) {
        retTyp = functionValueDescription._$returnType[paramIndex];
      }
    }
    return retTyp;
  }

  findValueDescriptionFromChain(
    codeDocument: CodeDocument,
    idChain: ReturnChainType[]
  ): ValueDescription | undefined {
    const arrRes = this.findValDescArrFromChain(codeDocument, idChain);
    if (arrRes.length) {
      return arrRes[arrRes.length - 1].vd;
    }
    return;
  }

  findValDescArrFromChain(
    codeDocument: CodeDocument,
    idChain: ReturnChainType[],
  ): ValueDescriptionPath[] {
    if (idChain.length === 0) return [];
    if (idChain.some(one => (
      !(
        one instanceof FunctionCallReturnChainType ||
        one instanceof IdentifierInBracketNotationReturnChainType ||
        one instanceof IdentifierReturnChainType
      )
    ))) {
      return [];
    }
    const theIdChain = idChain.slice() as Array<FunctionCallReturnChainType | IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType>;

    const result: ValueDescriptionPath[] = [];
    const vdPathIterator = this.iterateByRetChainTyp(codeDocument);
    let nextVdPath = vdPathIterator.next();
    let curVdPath: ValueDescriptionPath | undefined = nextVdPath.value;
    while (!nextVdPath.done && curVdPath?.vd) {
      if (!(curVdPath.vd instanceof PackageDescription) || !curVdPath.vd._$isInternal) {
        result.push(curVdPath);
      }

      if (result.length >= theIdChain.length) {
        vdPathIterator.next();
        break;
      }

      nextVdPath = vdPathIterator.next(theIdChain[result.length]);
      curVdPath = nextVdPath.value;
    }

    // if the last one is of type any then populate the rest according to the symbol chain
    if (
      result.length &&
      result.length < idChain.length &&
      result[result.length - 1].vd instanceof ReferenceValueDescription &&
      (result[result.length - 1].vd as ReferenceValueDescription)._$valueType.isAnyObject
    ) {
      // populate the rest with any vd
      while (result.length < idChain.length) {
        result.push(
          new ValueDescriptionPath(
            idChain[result.length].label,
            createRefValDesc([`${idChain[result.length].label}:any`], IdentifierType.Any)
          )
        );
      }
    }

    while (result.length < idChain.length) {
      result.push(
        new ValueDescriptionPath(
          idChain[result.length].label,
          createRefValDesc([`${idChain[result.length].label}:unknown`], IdentifierType.UNRECOGNIZED)
        )
      );
    }

    return result;
  }

}

export const createSymbolTable = SymbolTable.buildOne.bind(SymbolTable);

export const ValueDescriptionDictionaryFunctionKey = '_$ValueDescriptionDictionaryFunctionKey';
export type ValueDescriptionDictionary = Map<IdentifierType | string, DescriptorCollection[]>;

SymbolTable.globalSymbolTable = createSymbolTable({});
SymbolTable.globalValueDescriptionDict
  = SymbolTable.globalSymbolTable.generateValueDescriptionDictionary();

export const emtpyFunRetTyp = SymbolTable.emtpyFunRetTyp;
export const globalSymbolTableBase = SymbolTable.globalSymbolTableBase;
export const globalSymbolTable = SymbolTable.globalSymbolTable;