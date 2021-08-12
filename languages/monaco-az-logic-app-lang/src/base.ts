import {ASTNode} from "@monaco-imposture-tools/core";

export type DataType =
    'dualAtSymbol' |
    'atSymbol' |
    'atTemplateSubstitutionElement' |
    'parentheses' |
    'comma' |
    'function-call-complete' |
    'function-call' |
    'function-call-target' |
    'identifiers' |
    'identifiers:wPunctuation' |
    'identifiers-capture' |
    'object-identifiers' |
    'object-identifiers:wPunctuation' |
    'object-identifiers-captures' |
    'punctuation' |
    'punctuation-capture' |
    'array-literal' |
    'number' |
    'string' |
    'boolean' |
    'null';

interface $impostureLangType<T = DataType>{
    type?:string,
    dataType?:T,
    namespaces:string[]
}

export type AzLogicAppNodeType<T extends DataType> = AzLogicAppNode & {
    $impostureLang?: $impostureLangType<T>
}

export type AzLogicAppNode = ASTNode & {
    $impostureLang?: $impostureLangType;
}


export type ReturnChainType =
  UnknownReturnChainType |
  PrimitiveReturnChainType |
  ArrayLiteralReturnChainType |
  FunctionCallReturnChainType |
  IdentifierReturnChainType |
  IdentifierInBracketNotationReturnChainType;
interface AbstractReturnChainType{
    type: DataType | 'unknown',
    label:string,
    node: ASTNode
}
export interface UnknownReturnChainType extends AbstractReturnChainType{
    type: Exclude<
      AbstractReturnChainType['type'],
      PrimitiveReturnChainType['type'] |
      ArrayLiteralReturnChainType['type'] |
      FunctionCallReturnChainType['type'] |
      IdentifierReturnChainType['type'] |
      IdentifierInBracketNotationReturnChainType['type']
      >
    content: string
}
export interface PrimitiveReturnChainType extends AbstractReturnChainType{
    type: 'number'| 'string' | 'boolean' | 'null'
}
export interface ArrayLiteralReturnChainType extends AbstractReturnChainType{
    type: 'array-literal',
}
export interface FunctionCallReturnChainType extends AbstractReturnChainType{
    type: 'function-call-complete',
    functionFullName: string
}
export interface IdentifierReturnChainType extends AbstractReturnChainType{
    type: 'identifiers' | 'identifiers:wPunctuation' |
      'object-identifiers' | 'object-identifiers:wPunctuation',
    identifierName:string
}
export interface IdentifierInBracketNotationReturnChainType extends AbstractReturnChainType{
    type: 'array-literal',
    isBracketNotation: true,
    identifierName:string,
    punctuationNode:AzLogicAppNodeType<'punctuation'>,
    propertyNameNode:AzLogicAppNodeType<'string'>,
    propertyNameOffset:number,
    propertyNameLength:number,
}

export enum ParenthesesElderSiblingType{
    UNKNOWN                                     = 0xa00,
    NOT_FOUND                                   = 0xa01,
    FUNCTION_CALL                               = 0xa02,
    BENEATH_A_PAIR_OF_PARENTHESES               = 0xa03,
}


export enum DescriptionType{
    FunctionValue= 0x101,
    OverloadedFunctionValue,
    ReferenceValue,
    PackageReference,
}


// todo abs clazz better?
export class DescriptorCollectionItem{

    public readonly vd?: ValueDescription
    // emptyFunctionReturn
    public readonly funVd?: FunctionValueDescription | OverloadedFunctionValueDescription
    public readonly returnPath?: string[]
    public readonly returnVd?: ValueDescription
    public readonly overloadedFunParaIndex?: number
    // overloadedFunction
    public readonly overloadedFunVd?: OverloadedFunctionValueDescription
    public readonly overloadedIndex?: number

    static BASIC = (vd: ValueDescription)=>
      new DescriptorCollectionItem('basic', {vd});
    static EMPTY_PARA_FUN_RET = (
      funVd: FunctionValueDescription | OverloadedFunctionValueDescription,
      returnPath: string[],
      returnVd: ValueDescription,
      overloadedFunParaIndex?:number
    )=>
      new DescriptorCollectionItem('emptyParaFunctionReturn', {funVd, returnPath, returnVd, overloadedFunParaIndex});
    static OVERLOADED_FUN = (
      overloadedFunVd: OverloadedFunctionValueDescription,
      overloadedIndex: number
    )=>
      new DescriptorCollectionItem('overloadedFunction', {overloadedFunVd, overloadedIndex});

    private constructor(
      public readonly type: 'basic' | 'emptyParaFunctionReturn' | 'overloadedFunction',
      option: Partial<{
          // basic
          vd: ValueDescription,
          // emptyFunctionReturn
          funVd: ValueDescription,
          returnPath: string[],
          returnVd: ValueDescription,
          overloadedFunParaIndex: number,
          // overloadedFunction
          overloadedFunVd: ValueDescription,
          overloadedIndex: number
      }>
    ) {
        if (this.type === 'basic'){
            if (!option.vd) throw new Error(`Incorrect basic descriptorCollectionItem: vd is missing`);
        }else if (this.type === 'emptyParaFunctionReturn'){
            if (
              !option.funVd ||
              !option.returnPath ||
              !Array.isArray(option.returnPath) ||
              !option.returnVd
            ) throw new Error(`Incorrect emptyParaFunctionReturn descriptorCollectionItem: funVd, returnPath or returnVd is missing`)
        }else if (this.type === 'overloadedFunction'){
            if (
              !option.overloadedFunVd ||
              typeof option.overloadedIndex !== "number"
            ) throw new Error(`Incorrect overloadedFunction descriptorCollectionItem: overloadedFunVd or overloadedIndex is missing`)
        }else{
            throw new Error(`Incorrect descriptorCollectionItem type: ${type}`)
        }
        Object.assign(this, option);
    }
}

export interface DescriptorCollection<T extends string[] = string[]>{
    paths: T,
    valDescCollItem: DescriptorCollectionItem
}

// todo might need to covert it into clazz
export enum IdentifierTypeName{
    Any     = 0x001,
    Boolean,
    String,
    Number,
    AnyObject ,
    Array ,
    StringArray ,
    NumberArray ,
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

    static FUNCTION = (
      functionParameterTypes: IdentifierType[],
      functionReturnType: IdentifierType,
    )=>
      new IdentifierType(IdentifierTypeName.FUNCTION, {functionParameterTypes, functionReturnType})
    static OBJECT = (objValTypChainList:string[]) =>
      new IdentifierType(IdentifierTypeName.OBJECT, {objValTypChainList});
    static CONSTANT = (constantValues?: any[]) =>
      new IdentifierType(IdentifierTypeName.CONSTANT, {constantValues});
    static FUNCTION_RETURN_TYPE = (returnTypeChainList?: string[]) =>
      new IdentifierType(IdentifierTypeName.FUNCTION_RETURN_TYPE, {returnTypeChainList});

    // CONSTANT
    public readonly constantValues?: any[]
    // FUNCTION_RETURN_TYPE
    public readonly returnTypeChainList?: string[]
    // Function
    public readonly functionParameterTypes?: IdentifierType[]
    public readonly functionReturnType?: IdentifierType
    // OBJECT
    public readonly objValTypChainList?: string[]

    private constructor(
      public readonly type:IdentifierTypeName,
      option: Partial<{
          // CONSTANT
          constantValues: any[],
          // FUNCTION_RETURN_TYPE
          returnTypeChainList: string[],
          // Function
          functionParameterTypes: IdentifierType[],
          functionReturnType: IdentifierType,
          // OBJECT
          objValTypChainList: string[],
      }> = {},
    ) {
        if (type === IdentifierTypeName.FUNCTION){
            if (
              !Array.isArray(option.functionParameterTypes) ||
              !option.functionReturnType
            ){
                new Error(`Incorrect function identifier: functionParameterTypes or functionReturnType missing`);
            }
        }else if (type === IdentifierTypeName.CONSTANT){
            if (!Array.isArray(option.constantValues)){
                new Error(`Incorrect constant identifier: constantValues missing`);
            }
        }else if (type === IdentifierTypeName.FUNCTION_RETURN_TYPE){
            if (!Array.isArray(option.returnTypeChainList)){
                new Error(`Incorrect function return type identifier: returnTypeChainList missing`);
            }
        }else if (type === IdentifierTypeName.OBJECT){
            if (!Array.isArray(option.objValTypChainList)){
                new Error(`Incorrect object value type identifier: objValTypChainList missing`);
            }
        }
        Object.assign(this, option);
    }

    get label():string{
        switch (this.type){
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
                return 'composite:constant';
            case IdentifierTypeName.FUNCTION_RETURN_TYPE:
                return 'composite:functionReturnType';

            default:
                return 'unknown';
        }
    }

    get isAnyObject():boolean{
        return this.type === IdentifierTypeName.Any ||
          this.type === IdentifierTypeName.AnyObject ||
          this.type === IdentifierTypeName.AnyObjectList
          ;
    }

    get isComposite():boolean{
        return this.type === IdentifierTypeName.FUNCTION ||
          this.type === IdentifierTypeName.OBJECT ||
          this.type === IdentifierTypeName.CONSTANT ||
          this.type === IdentifierTypeName.FUNCTION_RETURN_TYPE
          ;
    }

    get isVarList():boolean{
        return this.type === IdentifierTypeName.ArrayList ||
          this.type === IdentifierTypeName.StringArrayList ||
          this.type === IdentifierTypeName.NumberArrayList ||
          this.type === IdentifierTypeName.AnyObjectList
          ;
    }

    get isObject():boolean{
        return this.type === IdentifierTypeName.Any ||
          this.type === IdentifierTypeName.AnyObject ||
          this.type === IdentifierTypeName.XML ||
          this.type === IdentifierTypeName.ArrayList ||
          this.type === IdentifierTypeName.AnyObjectList
          ;
    }

    get isArray():boolean{
        return this.type === IdentifierTypeName.Any ||
          this.type === IdentifierTypeName.Array ||
          this.type === IdentifierTypeName.StringArray ||
          this.type === IdentifierTypeName.NumberArray
          ;
    }

    get returnTypeCandidates():IdentifierType[]{
        if (
            this.type === IdentifierTypeName.ArrayList ||
            this.type === IdentifierTypeName.Any
        ){
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
        }else if (this.isVarList){
            switch (this.type) {
                case IdentifierTypeName.StringArrayList:
                    return [
                        IdentifierType.Any,
                        IdentifierType.String,
                    ];
                case IdentifierTypeName.NumberArrayList:
                    return [
                        IdentifierType.Any,
                        IdentifierType.NumberArray,
                    ];
                case IdentifierTypeName.AnyObjectList:
                    return [
                        IdentifierType.Any,
                        IdentifierType.AnyObject,
                        IdentifierType.XML
                    ];
                default:
                    return [
                        IdentifierType.Any,
                        this
                    ];
            }
        }else if (this.isArray){
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
                    return [
                        IdentifierType.Any,
                        IdentifierType.StringArray,
                        IdentifierType.StringArrayList,
                    ];
                case IdentifierTypeName.NumberArray:
                    return [
                        IdentifierType.Any,
                        IdentifierType.NumberArray,
                        IdentifierType.NumberArrayList,
                    ];
                default:
                    return [
                        IdentifierType.Any,
                        this
                    ];
            }
        }else{
            return [
                IdentifierType.Any,
                this
            ];
        }
    }

    /**
     * assign source to target
     * @param source
     * @param target
     */
    assignableTo(target?:IdentifierType):boolean{
        const source = this;
        if (!source) return false
        if (!target) return false
        if (
          source === IdentifierType.Any ||
          target === IdentifierType.Any
        ){
            return true;
        }
        if (
          target === IdentifierType.Array && source.isArray
        ){
            return true;
        }

        if (
          target === IdentifierType.AnyObject && source.isObject
        ){
            return true;
        }

        if (
          target === IdentifierType.ArrayList
        ){
            return true;
        }

        if (
          target === IdentifierType.StringArrayList && (
            source === IdentifierType.String ||
            source === IdentifierType.StringArrayList
          )
        ){
            return true;
        }

        if (
          target === IdentifierType.NumberArrayList && (
            source === IdentifierType.Number ||
            source === IdentifierType.StringArrayList
          )
        ){
            return true;
        }

        if (
          target === IdentifierType.AnyObjectList && (
            source === IdentifierType.AnyObject ||
            source === IdentifierType.XML ||
            source === IdentifierType.AnyObjectList
          )
        ){
            return true;
        }

        // todo: implement the deep comparison b/w CONSTANT and FUNCTION_RETURN_TYPE types

        return  source === target;
    }

}



export type ValueDescription =
  FunctionValueDescription |
  OverloadedFunctionValueDescription |
  ReferenceValueDescription |
  PackageDescription;

export interface AbstractValueDescription{
    _$type: DescriptionType,
    _$desc: string[],
    _$isOptional?: boolean
}

export interface FunctionValueDescription extends AbstractValueDescription{
    _$type: typeof DescriptionType.FunctionValue,
    _$parameterTypes: IdentifierType[],
    _$returnType: IdentifierType
}

export function createFunValDesc(
  descStrings: string[],
  parameterTypes: IdentifierType[],
  returnType: IdentifierType
):FunctionValueDescription{
    return {
        _$type: DescriptionType.FunctionValue,
        _$desc: descStrings,
        _$parameterTypes: parameterTypes,
        _$returnType: returnType
    }
}

export interface OverloadedFunctionValueDescription extends AbstractValueDescription{
    _$type: typeof DescriptionType.OverloadedFunctionValue,
    _$parameterTypes: IdentifierType[][],
    _$returnType: IdentifierType[]
}

export function createOverloadedFunValDesc(
  descStrings: string[],
  parameterTypes: IdentifierType[][],
  returnType: IdentifierType[]
):OverloadedFunctionValueDescription{
    if (parameterTypes.length !== returnType.length){
        new Error(`Incorrect overloaded function description: the size of parameterTypes mismatches with returnType's`);
    }
    return {
        _$type: DescriptionType.OverloadedFunctionValue,
        _$desc: descStrings,
        _$parameterTypes: parameterTypes,
        _$returnType: returnType
    }
}

export interface ReferenceValueDescription extends AbstractValueDescription{
    _$type: DescriptionType.ReferenceValue,
    _$valueType: IdentifierType,
    _$value?: any,
}

export function createRefValDesc(
  descStrings: string[],
  valueType: IdentifierType,
  optional?:boolean,
  value?: any,
):ReferenceValueDescription{
    return {
        _$type: DescriptionType.ReferenceValue,
        _$desc: descStrings,
        _$valueType: valueType,
        _$value: value,
        _$isOptional: optional
    }
}

export interface PackageDescription extends AbstractValueDescription{
    _$type: DescriptionType.PackageReference,
    _$subDescriptor: Record<string, ValueDescription>,
}

export function createPkgValDesc(
  descStrings: string[],
  subDescriptor: Record<string, ValueDescription>,
):PackageDescription{
    return {
        _$type: DescriptionType.PackageReference,
        _$desc: descStrings,
        _$subDescriptor: subDescriptor,
    }
}

export type ValueDescriptor = ValueDescription &{
    _$functionReturnType: ValueDescription
}

export const ValueDescriptionDictionaryFunctionKey = '_$ValueDescriptionDictionaryFunctionKey'
export type ValueDescriptionDictionary = Map<
  IdentifierType| string,
  DescriptorCollection[]>
