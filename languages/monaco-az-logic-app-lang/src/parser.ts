import {ASTNode, CodeDocument} from "@monaco-imposture-tools/core";
import {AzLogicAppLangConstants, AzLogicAppNode, AzLogicAppNodeType,} from "./base";
import {
  AbstractReturnChainType,
  AzLogicAppNodeUtils,
  IdentifierInBracketNotationReturnChainType,
  IdentifierReturnChainType,
  ReturnChainType,
} from './azLgcNodesUtils';
import {
  createRefValDesc,
  DescriptionType,
  FunctionValueDescription,
  IdentifierType,
  IdentifierTypeName,
  OverloadedFunctionValueDescription,
  PackageDescription,
  ReferenceValueDescription,
  SymbolTable,
  ValueDescription,
  ValueDescriptionPath,
} from './values'
import {
  DiagnosticSeverity,
  ErrorCode,
  ValidateResult,
  ValidationIntermediateContext,
  WrapperType
} from "./validateHelper";

// ------------------------ gen cst nodes  ----------------------------

// base AST
export abstract class SyntaxNode {

  public parent?: SyntaxNode;

  protected _cachedChildren:SyntaxNode[]|undefined;
  public get children():SyntaxNode[]{
    if (!this._cachedChildren){
      this._cachedChildren  = [];
    }
    return this._cachedChildren;
  }

  public  elderSibling?: SyntaxNode;
  public  youngerSibling?: SyntaxNode;

  get eldestSibling(){
    let ret = this as SyntaxNode;
    while (ret.elderSibling){
      ret = ret.elderSibling;
    }
    return ret;
  }

  get youngestSibling(){
    let ret = this as SyntaxNode;
    while (ret.youngerSibling){
      ret = ret.youngerSibling;
    }
    return ret;
  }


  public readonly siblings = {
    [Symbol.iterator]: ()=>{
      let cur: SyntaxNode|undefined = this.eldestSibling;
      const ret:Iterator<SyntaxNode|undefined> =  {
        return(value?: any): IteratorResult<SyntaxNode, any> {
          cur = undefined;
          return {value: undefined, done: true};
        },
        next(...args): IteratorResult<SyntaxNode, any> {
          const value = cur;
          cur = cur?.youngerSibling;
          return !!value ?
            {value, done:false}:
            {value, done: true}
        }
      };
      return ret;
    }
  }

  abstract hasLValue:boolean;
  abstract hasRValue:boolean;
  abstract hasReturnValue:boolean;

  public get lValue(): ValueDescription | undefined {
    return undefined;
  }
  public get rValue(): ValueDescription | undefined{
    return undefined;
  }

  private _cachedReturnValue: ValueDescription | undefined = undefined;
  public get returnValue():ValueDescription | undefined{
    if (!this._cachedReturnValue && this.youngerSibling && this.youngerSibling.hasReturnValue){
      this._cachedReturnValue =  this.youngerSibling.returnValue;
    }
    if (!this._cachedReturnValue && this.hasReturnValue){
      this._cachedReturnValue = this.rValue
    }
    return this._cachedReturnValue;
  }

  get returnType():IdentifierType | undefined{
    const curReturnVal = this.returnValue;
    if (curReturnVal){
      switch (curReturnVal._$type) {
        case DescriptionType.ReferenceValue:
          return curReturnVal._$valueType;
        case DescriptionType.PackageReference:
          return curReturnVal._$identifierType;
        case DescriptionType.FunctionValue:
          throw new Error(`Syntax node default return type can not infer return type from FunctionValue`);
        case DescriptionType.OverloadedFunctionValue:
          throw new Error(`Syntax node default return type can not infer return type from OverloadedFunctionValue`);
      }
    }
    return undefined;
  }

  get returnedNode():SyntaxNode{
    let result:SyntaxNode = this as SyntaxNode;
    while (result.youngerSibling && result.youngerSibling.hasReturnValue){
      result = result.youngerSibling;
    }
    return result;
  }

  protected constructor(
    public readonly astNode: ASTNode
  ) {
  }

  get offset():number{
    return this.astNode.offset;
  }

  get length():number{
    return this.astNode.length || 0;
  }

  abstract traverse(cb:(syntaxNode:SyntaxNode, depth:number)=>void, depth:number):void;

}

// parenthesis expression
export class ParenthesisNode extends SyntaxNode{

  readonly hasLValue: boolean = false;
  readonly hasRValue: boolean = true;
  readonly hasReturnValue: boolean = true;


  constructor(
    astNode: ASTNode,
    public readonly content: SyntaxNode[]
  ) {
    super(astNode);
    content.forEach(one=> one.parent = this);
  }

  public get children():SyntaxNode[]{
    return this.content;
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    const nextDepth = depth+1;
    cb(this, depth);
    this.children.forEach(one=> one.traverse(cb, nextDepth));
  }

  private _cachedLastNodeWithReturnValue: SyntaxNode | undefined;
  get lastNodeWithReturnValue(){
    if (!this._cachedLastNodeWithReturnValue){
      let index = this.content.length;
      while(index > -1){
        if(this.content[index].hasReturnValue){
          this._cachedLastNodeWithReturnValue = this.content[index];
          break;
        }
        index--;
      }
    }
    return this._cachedLastNodeWithReturnValue;
  }

  public get rValue(): ValueDescription | undefined{
    return this._cachedLastNodeWithReturnValue?.returnValue;
  }

  public get returnValue(): ValueDescription | undefined{
    return this._cachedLastNodeWithReturnValue?.returnValue;
  }

  private _cachedCommaIndices:number[];
  public get commaIndices():number[]{
    if (!this._cachedCommaIndices){
      this._cachedCommaIndices = [];
      this.content.forEach((value, index) => {
        if (value instanceof CommaPunctuator){
          this._cachedCommaIndices.push(index);
        }
      });
    }
    return this._cachedCommaIndices.slice();
  }

  private _ensureCommaIndicesPopulated(){
    if(!this._cachedCommaIndices){
      this._cachedCommaIndices = this.commaIndices;
    }
  }

  public get parameterSize(){
    this._ensureCommaIndicesPopulated();
    return this._cachedCommaIndices.length === 0?
      this.content.length > 0 ? 1: 0:
      this._cachedCommaIndices.length+1;
  }

  public parameter(index:number):SyntaxNode|undefined{
    this._ensureCommaIndicesPopulated();
    if (
      index === 0 && !(this.content[0] instanceof CommaPunctuator)
    ){
      return this.content[0];
    }else if (
      index > 0 && index <= this._cachedCommaIndices.length &&
      this._cachedCommaIndices[index-1]+1<this.content.length &&
      !(this.content[this._cachedCommaIndices[index-1]+1] instanceof CommaPunctuator)
    ){
      return this.content[this._cachedCommaIndices[index-1]+1];
    }else{
      return undefined;
    }
  }

  public comma(index:number):CommaPunctuator|undefined{
    this._ensureCommaIndicesPopulated();
    if (index >= 0 && index < this._cachedCommaIndices.length){
      return this.content[this._cachedCommaIndices[index]] as CommaPunctuator;
    }
    return undefined;
  }

  public paramIndexByOffset(offset:number){
    this._ensureCommaIndicesPopulated();
    if (
      this.offset+1 <= offset &&
      this.offset+ this.length -1 >= offset
    ){
      let paramIndex = 0;
      while(
        paramIndex < this.parameterSize &&
        offset > this.endPosOfParameter(paramIndex)
      ){
        paramIndex ++
      }
      return paramIndex;
    }else{
      return -1;
    }
  }

  public startPosOfParameter(paramIndex:number){
    this._ensureCommaIndicesPopulated();
    if (paramIndex <= 0){
      return this.offset + 1;
    }else if (paramIndex >= this._cachedCommaIndices.length + 1){
      return this.offset+ this.length -1
    }else {
      return this.content[this._cachedCommaIndices[paramIndex -1]].offset + 1;
    }
  }

  public endPosOfParameter(paramIndex:number){
    this._ensureCommaIndicesPopulated();
    if (paramIndex > this._cachedCommaIndices.length -1 ){
      return this.offset + this.length -1;
    }else if (paramIndex < 0){
      return  this.offset + 1;
    }else {
      return this.content[this._cachedCommaIndices[paramIndex]].offset + 1;
    }
  }

}

// function call
//   r values
export class FunctionCallNode extends SyntaxNode{
  readonly hasLValue: boolean = false;
  readonly hasRValue: boolean = true;
  readonly hasReturnValue: boolean = true;

  constructor(
    ast:ASTNode,
    public readonly functionFullName: string,
    public readonly functionValueDescription: FunctionValueDescription | OverloadedFunctionValueDescription,
    public readonly supportFunctionCallIdentifiers: IdentifierNode[],
    public readonly target: ValueDescription,
    public readonly parameters: ParenthesisNode,
    public readonly parameterSeq = 0
  ) {
    super(ast);
    supportFunctionCallIdentifiers.forEach(one=> one.parent = this);
    parameters.parent = this;
  }

  get targetOffset(){
    let result = this.astNode.offset;
    if (this.supportFunctionCallIdentifiers.length){
      result = this.supportFunctionCallIdentifiers[0].offset;
    }
    return result;
  }

  get targetLength(){
    const targetOffset = this.targetOffset;
    let result = 0;
    if (this.supportFunctionCallIdentifiers.length){
      result = this.supportFunctionCallIdentifiers[this.supportFunctionCallIdentifiers.length -1].offset;
      result += this.supportFunctionCallIdentifiers[this.supportFunctionCallIdentifiers.length -1].length;
      result -= targetOffset;
    }
    return result;
  }

  public get children():SyntaxNode[]{
    if (!this._cachedChildren){
      this._cachedChildren = [...this.supportFunctionCallIdentifiers, this.parameters];
    }
    return this._cachedChildren;
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    const nextDepth = depth+1;
    cb(this, depth);
    this.children.forEach(one=> one.traverse(cb, nextDepth));
  }

  _rValue: ReferenceValueDescription | PackageDescription | undefined = undefined;
  get rValue(): ReferenceValueDescription| PackageDescription | undefined {
    if (!this._rValue){
      switch (this.target._$type) {
        case DescriptionType.FunctionValue:
          this._rValue = createRefValDesc(
            [
              `Return value of function ${this.supportFunctionCallIdentifiers.map(one=>one.identifierName).join('.')}`
            ],
            this.target._$returnType
          );
          break;
        case DescriptionType.OverloadedFunctionValue:
          this._rValue = createRefValDesc(
            [
              `Return value of function ${this.supportFunctionCallIdentifiers.map(one=>one.identifierName).join('.')}`
            ],
            this.target._$returnType[this.parameterSeq]
          );
          break;
        default:
          this._rValue = this.target
          break;
      }
    }
    return this._rValue;
  }

  get isOverloadedFunction(){
    return this.target._$type === DescriptionType.OverloadedFunctionValue
  }

  // get functionType(){
  //   return this.target._$identifierType;
  // }

  get parameterTypes(){
    if (this.isOverloadedFunction){
      return (this.target as OverloadedFunctionValueDescription)
        ._$parameterTypes[this.parameterSeq]
    }else{
      return (this.target as FunctionValueDescription)
        ._$parameterTypes
    }
  }


  get returnType(){
    const curReturnVal = this.returnValue;
    switch (curReturnVal?._$type) {
      case DescriptionType.PackageReference:
        return curReturnVal._$identifierType;
      case DescriptionType.ReferenceValue:
        return curReturnVal._$valueType;
      case DescriptionType.OverloadedFunctionValue:
        return curReturnVal._$identifierType;
      case DescriptionType.FunctionValue:
        return curReturnVal._$identifierType;
      default:
        return undefined;
    }
  }

}

// literal
// r value
export abstract class LiteralValueNode extends SyntaxNode{
  readonly hasLValue: boolean = false;
  readonly hasRValue: boolean = true;
  readonly hasReturnValue: boolean = true;

  readonly abstract _valueDesc: ReferenceValueDescription;

  public get rValue(): ReferenceValueDescription | undefined{
    return this._valueDesc;
  }

  public get returnValue(): ReferenceValueDescription | undefined{
    return this._valueDesc;
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    cb(this, depth);
  }

}

// boolean
export class LiteralBooleanNode extends LiteralValueNode{

  static StringToBoolean(str:string):boolean{
    return str === 'true';
  }

  readonly _valueDesc: ReferenceValueDescription;

  constructor(
    astNode: ASTNode,
    public readonly  value:boolean
  ) {
    super(astNode);
    this._valueDesc = ReferenceValueDescription.buildOne(
      [
        ''+ value,
        'Boolean value'
      ],
      IdentifierType.Boolean,
      false,
      value
    );
  }
}
// string
export class LiteralStringNode extends LiteralValueNode{

  readonly _valueDesc: ReferenceValueDescription;

  constructor(
    astNode: ASTNode,
    public readonly  value:string
  ) {
    super(astNode);
    this._valueDesc = ReferenceValueDescription.buildOne(
      [
        value,
        'String value'
      ],
      IdentifierType.String,
      false,
      value
    )
  }

  isDoubleQuoted(){
    return this.astNode.$impostureLang?.type === "qstring-double";
  }
}
// number
export class LiteralNumberNode extends LiteralValueNode{

  static StringToNumber(str:string):number{
    return Number(str);
  }

  readonly _valueDesc: ReferenceValueDescription;

  constructor(
    astNode: ASTNode,
    public readonly value:number
  ) {
    super(astNode);
    this._valueDesc = ReferenceValueDescription.buildOne(
      [
        '' + value,
        'Number value'
      ],
      IdentifierType.Number,
      false,
      value
    );
  }
}
// null
export class LiteralNullNode extends LiteralValueNode{

  readonly _valueDesc: ReferenceValueDescription;

  constructor(
    astNode: ASTNode
  ) {
    super(astNode);
    this._valueDesc = ReferenceValueDescription.buildOne(
      [
        'null',
        'Null value'
      ],
      IdentifierType.Null,
      false,
      null
    );
  }
}

// literal array
export class LiteralArrayNode extends LiteralValueNode{

  readonly _valueDesc: ReferenceValueDescription;

  readonly squareBraceOffset: number;
  readonly squareBraceLength: number;

  constructor(
    astNode: ASTNode,
    public readonly content: SyntaxNode[]
  ) {
    super(astNode);
    let firstContentReturnValue:IdentifierType | undefined = undefined;
    content.forEach(one=>{
      one.parent = this;
    })
    // check the type of the content items and determine the return type
    for (let index = 0; index < content.length; index++){
      const value = content[index];
      if(
        !value.hasReturnValue ||
        value.returnValue?._$type !== DescriptionType.ReferenceValue
      ){
        break;
      }
      if (index ===0){
        firstContentReturnValue = value.returnValue._$valueType;
      }else if (firstContentReturnValue !== value.returnValue._$valueType){
        firstContentReturnValue = undefined;
        break;
      }
    }
    switch (firstContentReturnValue) {
      case IdentifierType.String:
        this._valueDesc = ReferenceValueDescription.buildOne(
          [
            'String array'
          ],
          IdentifierType.StringArray
        );
        break;
      case IdentifierType.Number:
        this._valueDesc = ReferenceValueDescription.buildOne(
          [
            'Number array'
          ],
          IdentifierType.NumberArray
        );
        break;
      default:
        this._valueDesc = ReferenceValueDescription.buildOne(
          [
            'Array'
          ],
          IdentifierType.Array
        );
        break;
    }

    // override the existing literal array
    if (
      this.astNode && this.astNode.$impostureLang?.dataType === "array-literal" &&
      (this.astNode as any).beginCaptureChildren?.length &&
      (this.astNode as any).beginCaptureChildren[0].scopeName === "meta.brace.square.azLgcAppExp" &&
      typeof (this.astNode as any).beginCaptureChildren[0].offset === 'number'
    ){
      this.squareBraceOffset = (this.astNode as any).beginCaptureChildren[0].offset;
    }else{
      this.squareBraceOffset = this.astNode.offset;
    }

    if (
      this.astNode && this.astNode.$impostureLang?.dataType === "array-literal" &&
      (this.astNode as any).endCaptureChildren?.length &&
      (this.astNode as any).endCaptureChildren[0].scopeName === "meta.brace.square.azLgcAppExp" &&
      typeof (this.astNode as any).endCaptureChildren[0].offset === 'number'
    ){
      this.squareBraceLength =
        (this.astNode as any).endCaptureChildren[0].offset
        + ((this.astNode as any).endCaptureChildren[0].length || 0)
        - this.squareBraceOffset
      ;
    }else{
      this.squareBraceLength = this.astNode.length || 0;
    }

  }

  get offset(){
    return this.squareBraceOffset;
  }

  get length(){
    return this.squareBraceLength;
  }

  public get children():SyntaxNode[]{
    return this.content;
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    const nextDepth = depth+1;
    cb(this, depth);
    this.children.forEach(one=> one.traverse(cb, nextDepth));
  }

  private _cachedCommaIndices:number[];
  public get commaIndices():number[]{
    if (!this._cachedCommaIndices){
      this._cachedCommaIndices = [];
      this.content.forEach((value, index) => {
        if (value instanceof CommaPunctuator){
          this._cachedCommaIndices.push(index);
        }
      });
    }
    return this._cachedCommaIndices.slice();
  }

  private _ensureCommaIndicesPopulated(){
    if(!this._cachedCommaIndices){
      this._cachedCommaIndices = this.commaIndices;
    }
  }

  public get itemSize(){
    this._ensureCommaIndicesPopulated();
    return this._cachedCommaIndices.length === 0?
      this.content.length > 0 ? 1: 0:
      this._cachedCommaIndices.length+1;
  }

  public item(index:number):SyntaxNode|undefined{
    this._ensureCommaIndicesPopulated();
    if (
      index === 0 && !(this.content[0] instanceof CommaPunctuator)
    ){
      return this.content[0];
    }else if (
      index > 0 && index <= this._cachedCommaIndices.length &&
      this._cachedCommaIndices[index-1]+1<this.content.length &&
      !(this.content[this._cachedCommaIndices[index-1]+1] instanceof CommaPunctuator)
    ){
      return this.content[this._cachedCommaIndices[index-1]+1];
    }else{
      return undefined;
    }
  }

  public comma(index:number):CommaPunctuator|undefined{
    this._ensureCommaIndicesPopulated();
    if (index >= 0 && index < this._cachedCommaIndices.length){
      return this.content[this._cachedCommaIndices[index]] as CommaPunctuator;
    }
    return undefined;
  }

  public startPosOfItem(itemIndex:number){
    this._ensureCommaIndicesPopulated();
    if (itemIndex <= 0){
      return this.offset + 1;
    }else if (itemIndex >= this._cachedCommaIndices.length + 1){
      return this.offset+ this.length -1
    }else {
      return this.content[this._cachedCommaIndices[itemIndex -1]].offset + 1;
    }
  }

  public endPosOfItem(itemIndex:number){
    this._ensureCommaIndicesPopulated();
    if (itemIndex > this._cachedCommaIndices.length -1 ){
      return this.offset + this.length -1;
    }else if (itemIndex < 0){
      return  this.offset + 1;
    }else {
      return this.content[this._cachedCommaIndices[itemIndex]].offset + 1;
    }
  }

  public itemIndexByOffset(offset:number){
    this._ensureCommaIndicesPopulated();
    if (
      this.offset+1 <= offset &&
      this.offset+ this.length -1 >= offset
    ){
      let paramIndex = 0;
      while(
        paramIndex < this.itemSize &&
        offset > this.endPosOfItem(paramIndex)
        ){
        paramIndex ++
      }
      return paramIndex;
    }else{
      return -1;
    }
  }
  
}

// identifier
//   l r values

export class IdentifierNode extends SyntaxNode{
  readonly hasLValue: boolean = true;
  readonly hasRValue: boolean = true;
  readonly hasReturnValue: boolean = true;

  constructor(
    astNode: ASTNode,
    public readonly identifierName: string,
    public target: ValueDescription | undefined
  ) {
    super(astNode);
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    cb(this, depth);
  }

  get lValue(){
    // phase two: todo we need to support lvalue before we supported scopes
    throw new Error('todo: implement it');
    return undefined;
  }

  get rValue(){
    return this.target;
  }

}

export class FunctionCallTarget extends IdentifierNode{

  readonly hasLValue: boolean = false;

  constructor(
    astNode: ASTNode,
    identifierName: string,
    target: FunctionValueDescription | OverloadedFunctionValueDescription | undefined,
    private _prefixAccessor?: AccessorPunctuator
  ) {
    super(astNode, identifierName, target);
    if (this._prefixAccessor){
      this._prefixAccessor.parent = this;
    }
  }

  public set prefixAccessor(prefixAccessor: AccessorPunctuator){
    this._prefixAccessor = prefixAccessor;
    if (this._prefixAccessor){
      this._prefixAccessor.parent = this;
    }
    this._cachedChildren = undefined;
  }

  public get children():SyntaxNode[]{
    if (!this._cachedChildren){
      this._cachedChildren = this.prefixAccessor?
        [this.prefixAccessor]: [];
    }
    return this._cachedChildren;
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    const nextDepth = depth+1;
    cb(this, depth);
    this.children.forEach(one => one.traverse(cb, nextDepth));
  }

  get lValue(){
    // currently we do not support any modification to defined function
    return undefined;
  }

}

export class IdentifierNodeWithPunctuation extends IdentifierNode{

  constructor(
    astNode: ASTNode,
    identifierName: string,
    readonly target: ReferenceValueDescription | PackageDescription,
    public readonly prefixAccessor: AccessorPunctuator
  ) {
    super(astNode, identifierName, target);
    prefixAccessor.parent = this;
  }

  public get children():SyntaxNode[]{
    if (!this._cachedChildren){
      this._cachedChildren = [this.prefixAccessor];
    }
    return this._cachedChildren;
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    const nextDepth = depth+1;
    cb(this, depth);
    this.prefixAccessor.traverse(cb, nextDepth);
  }

  get isOptional(){
    return this.prefixAccessor.isOptional;
  }
}

export class IdentifierNodeInBracketNotation extends IdentifierNode{

  constructor(
    astNode: ASTNode,
    identifierName: string,
    public readonly isPropertyLiteral: boolean,
    readonly target: ReferenceValueDescription | PackageDescription,
    public readonly literalArrayNode: LiteralArrayNode
  ) {
    super(astNode, identifierName, target);
    literalArrayNode.parent = this;
  }

  public get children():SyntaxNode[]{
    if (!this._cachedChildren){
      this._cachedChildren = this.literalArrayNode.children;
    }
    return this._cachedChildren;
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    const nextDepth = depth+1;
    cb(this, depth);
    this.literalArrayNode.traverse(cb, nextDepth);
  }

}

// punctuation
export class Punctuator extends SyntaxNode{
  readonly hasLValue: boolean = false;
  readonly hasRValue: boolean = false;
  readonly hasReturnValue: boolean = false;

  constructor(astNode: ASTNode) {
    super(astNode);
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    cb(this, depth);
  }

  get lValue(){
    return undefined;
  }

  get rValue(){
    return undefined;
  }

  get returnValue(){
    return undefined;
  }

}
// punctuation-accessor
export class AccessorPunctuator extends Punctuator{

  get isObjectIdentifierCapture():boolean{
    return this.astNode.$impostureLang?.dataType === 'object-identifiers-captures';
  }

  get isIdentifierCapture():boolean{
    return this.astNode.$impostureLang?.dataType === 'identifiers-capture';
  }

  get isStandalone():boolean{
    return this.astNode.$impostureLang?.type === 'punctuation-accessor' &&
    this.astNode.$impostureLang.dataType === 'punctuation';
  }

  get isOptional():boolean{
    if (this.isIdentifierCapture || this.isObjectIdentifierCapture){
      return this.astNode.scopeName.indexOf('optional') > -1 ||
        this.astNode.$impostureLang?.type === 'identifiers-p2-c2' ||
        this.astNode.$impostureLang?.type === 'object-identifiers-p0-c2';
    }else if(this.isStandalone){
      return this.astNode.children.some(value =>
        value.scopeName.indexOf('optional') > -1 ||
        value.$impostureLang?.type === 'punctuation-accessor-c2'
      )
    }
    return false;
  }

}
// punctuation-comma
export class CommaPunctuator extends Punctuator{}

// ------------------------ gen ast nodes  ----------------------------

// AzLgc nodes
// at symbol
export class AtSymbolNode extends SyntaxNode{

  readonly hasLValue: boolean = false;
  readonly hasRValue: boolean = false;
  readonly hasReturnValue: boolean = false;

  constructor(
    astNode: ASTNode
  ) {
    super(astNode);
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    cb(this, depth);
  }

}

// escapedAtSymbol
// r val
export class EscapedAtSymbolNode extends SyntaxNode{

  static RETURN_VALUE:ReferenceValueDescription = ReferenceValueDescription.buildOne(
    [
      '@',
      'Escaped at symbol'
    ],
    IdentifierType.String,
    false,
    '@'
  );

  readonly hasLValue: boolean = false;
  readonly hasRValue: boolean = true;
  readonly hasReturnValue: boolean = true;

  constructor(
    astNode: ASTNode
  ) {
    super(astNode);
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    cb(this, depth);
  }

  get returnValue(){
    return EscapedAtSymbolNode.RETURN_VALUE;
  }

}

// root function call
// r val
export class RootFunctionCallNode extends SyntaxNode{

  readonly hasLValue: boolean = false;
  readonly hasRValue: boolean = true;
  readonly hasReturnValue: boolean = true;

  protected _cachedChildren:SyntaxNode[];

  constructor(
    astNode: ASTNode,
    public readonly precedingNodes: SyntaxNode[],
    public readonly atSymbolNode: AtSymbolNode,
    public readonly innerFunctionCallNode: FunctionCallNode | undefined,
    public readonly followingNodes: SyntaxNode[]
  ) {
    super(astNode);
    atSymbolNode.parent = this;
    if (innerFunctionCallNode){
      innerFunctionCallNode.parent = this;
    }
    this._cachedChildren = [
      ...this.precedingNodes,
      this.atSymbolNode,
      this.innerFunctionCallNode,
      ...this.followingNodes,
    ].filter(Boolean) as SyntaxNode[];
    this._cachedChildren.forEach(one => one.parent = this);
  }

  public get children():SyntaxNode[]{
    return this._cachedChildren;
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    const nextDepth = depth+1;
    cb(this, depth);
    this.children.forEach(one=>one.traverse(cb, nextDepth));
  }

  public get rValue(): ValueDescription | undefined{
    return this.innerFunctionCallNode?.rValue;
  }

  public get returnValue(): ValueDescription | undefined{
    return this.innerFunctionCallNode?.returnValue;
  }
}

// expression template
// r val
export class ExpressionTemplateNode extends SyntaxNode{

  readonly hasLValue: boolean = false;
  readonly hasRValue: boolean = true;
  readonly hasReturnValue: boolean = true;

  constructor(
    astNode: ASTNode,
    public readonly content: SyntaxNode[]
  ) {
    super(astNode);
    content.forEach(one => {
      one.parent = this;
    })
  }

  public get children():SyntaxNode[]{
    return this.content;
  }

  traverse(cb: (syntaxNode: SyntaxNode, depth:number) => void, depth) {
    const nextDepth = depth+1;
    cb(this, depth);
    this.children.forEach(one=>one.traverse(cb, nextDepth));
  }

  private _cachedFirstNodeWithReturnValue: SyntaxNode | undefined;
  get firstNodeWithReturnValue(){
    if (!this._cachedFirstNodeWithReturnValue){
      this.content.some(one => {
        if (one.hasReturnValue){
          this._cachedFirstNodeWithReturnValue = one;
          return true;
        }
        return false;
      })
    }
    return this._cachedFirstNodeWithReturnValue;
  }

  public get rValue(): ValueDescription | undefined{
    return this._cachedFirstNodeWithReturnValue?.returnValue;
  }

  public get returnValue(): ValueDescription | undefined{
    return this._cachedFirstNodeWithReturnValue?.returnValue;
  }
}

// AzLgcExpDocument

export class AzLgcExpDocument{

  constructor(
    public readonly codeDocument:CodeDocument,
    public readonly entries:SyntaxNode[],
    public readonly validateResult:ValidateResult
  ) {
  }

  get globalSymbolTable(){
    return this.validateResult.globalSymbolTable;
  }

  traverseSyntaxNodes(cb: (syntaxNode: SyntaxNode, depth: number) => void) {
    this.entries.forEach(one=>one.traverse(cb, 0));
  }

  consoleLogSyntaxNodes(){
    this.traverseSyntaxNodes((syntaxNode, depth) => {
      console.log(`[AzLgcExpDocument::consoleLogSyntaxNodes] ${depth}|${new Array(depth+1).join('\t')} ${(syntaxNode as any).__proto__.constructor.name}`)
    })
  }

  getSyntaxNodeByOffset(offset:number):SyntaxNode | undefined{
    let result:SyntaxNode| undefined = undefined;

    for (let i = 0; i < this.entries.length; i++){
      let workingNode = this.entries[i];
      let found = false;
      if (
        workingNode.offset <= offset &&
        workingNode.offset + workingNode.length >= offset
      ){
        while (workingNode && !found){
          if (!workingNode.children.length){
            found = true;
            break;
          }
          let matchedChildNode: SyntaxNode | undefined;
          workingNode.children.forEach(one => {
            if (one.offset <= offset && one.offset + one.length >= offset) {
              if (!matchedChildNode) {
                matchedChildNode = one;
              } else {
                matchedChildNode = matchedChildNode.offset < one.offset ? one : matchedChildNode;
              }
            }
          });
          if (!matchedChildNode) break;
          workingNode = matchedChildNode;
        }
        result = workingNode;
        break;
      }
    }

    return result;
  }

}

// parsing procedures

interface ParserRes{
  nodes: SyntaxNode[],
  ctx: ValidationIntermediateContext
}

function _parse_root_function_call(node: AzLogicAppNode, ctx: ValidationIntermediateContext):ParserRes{
  let nodes:SyntaxNode[] = [];
  const returnCtx = {...ctx, directWrapperType: WrapperType.ROOT_FUNCTION_CALL};
  const rootFunctionCallRes = _parse_children(node, ctx);
  const childrenSyntaxNodes = rootFunctionCallRes.nodes;

  // check whether childrenSyntaxNodes are consist of one symbol at and a function call complete
  Object.assign(returnCtx, rootFunctionCallRes.ctx);

  if (
    childrenSyntaxNodes.length > 0 &&
    childrenSyntaxNodes[0] instanceof AtSymbolNode
  ){
    let atSymbolNode = childrenSyntaxNodes[0];
    let innerFunctionCallNode: FunctionCallNode|undefined = undefined;
    let precedingNodes:SyntaxNode[] = [];
    let followingNodes:SyntaxNode[] = childrenSyntaxNodes.slice(1);

    childrenSyntaxNodes.some((value, index) => {
      if (value instanceof FunctionCallNode){
        if (
          index>0 &&
          childrenSyntaxNodes[index-1] instanceof AtSymbolNode &&
          childrenSyntaxNodes[index-1] !== atSymbolNode
        ){
          precedingNodes = childrenSyntaxNodes.slice(0, index-1);
          atSymbolNode = childrenSyntaxNodes[index-1]
        }
        innerFunctionCallNode = value;
        followingNodes = childrenSyntaxNodes.slice(index+1);
        return true;
      }
      return false;
    });

    const rootFunctionCall = new RootFunctionCallNode(
      node,
      precedingNodes,
      atSymbolNode,
      innerFunctionCallNode,
      followingNodes
    );

    nodes.push(rootFunctionCall);

    // validate precedingNodes
    if (!ctx.vr.hasProblems()){
      precedingNodes.forEach((one, index)=>{
        if (one instanceof AtSymbolNode){
          if (one!== atSymbolNode){
            ctx.vr.problems.push({
              severity: DiagnosticSeverity.Error,
              code: ErrorCode.INVALID_AT_SYMBOL,
              message: `Invalid symbol @`,
              startPos: ctx.vr.codeDocument.positionAt(one.offset),
              endPos: ctx.vr.codeDocument.positionAt(one.offset + one.length),
              node,
            });
          }
        }
      })
    }

    // validate the atSymbolNode innerFunctionCallNode and over all surroundings
    if (!ctx.vr.hasProblems()){
      if (
        precedingNodes.length ||
        (
          followingNodes.length &&
            followingNodes.some(value =>(
              !(value instanceof IdentifierNodeWithPunctuation || value instanceof IdentifierNodeInBracketNotation)
            ))
        ) ||
        (
          ctx.vr.codeDocument.text.slice(0, rootFunctionCall.offset)
            .concat(
              ctx.vr.codeDocument.text.slice(
                rootFunctionCall.offset + rootFunctionCall.length,
                ctx.vr.codeDocument.text.length-1
              )
            ).replace(/\s/g, '').length
        )
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_ROOT_FUNCTION_CALL,
          message: `The function call must take the completion string`,
          startPos: ctx.vr.codeDocument.positionAt(rootFunctionCall.offset),
          endPos: ctx.vr.codeDocument.positionAt(rootFunctionCall.offset + rootFunctionCall.length),
          node,
        })
      }else if (
        !! atSymbolNode &&
        ! innerFunctionCallNode
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_AT_SYMBOL,
          message: `Invalid symbol @ which missed following identifiers`,
          startPos: ctx.vr.codeDocument.positionAt(atSymbolNode.offset),
          endPos: ctx.vr.codeDocument.positionAt(atSymbolNode.offset + (atSymbolNode.length || 0)),
          node,
        });
      }else if (
        !! atSymbolNode &&
        !! innerFunctionCallNode
      ){

        // need ensure the offset of the atsymbol and start of the function-call are the same position
        if (
          !!innerFunctionCallNode &&
          atSymbolNode.offset + atSymbolNode.length !==
          (innerFunctionCallNode as FunctionCallNode).offset
        ){
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.INVALID_ROOT_FUNCTION_CALL,
            message: `There should be no spaces or tokens between @ and the function name`,
            startPos: ctx.vr.codeDocument.positionAt(rootFunctionCall.offset),
            endPos: ctx.vr.codeDocument.positionAt(rootFunctionCall.offset + rootFunctionCall.length),
            node,
          })
        }

        // check if any UNRECOGNIZED_TOKENS exist
        const startPos = rootFunctionCall.offset;
        const endPos = rootFunctionCall.offset + rootFunctionCall.length;
        const firstChild = precedingNodes.length? precedingNodes[0]: atSymbolNode;
        const lastChild = followingNodes.length? followingNodes[followingNodes.length - 1]: innerFunctionCallNode;

        if (
          !ctx.vr.codeDocument.text.substr(
            startPos,
            firstChild.offset - startPos
          )
            .match(/^\s*$/)
        ){
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.UNRECOGNIZED_TOKENS,
            message: `Unrecognized tokens`,
            startPos: ctx.vr.codeDocument.positionAt(startPos),
            endPos: ctx.vr.codeDocument.positionAt( firstChild.offset ),
            node: rootFunctionCall.astNode as any,
            data:{
              code: 'UNRECOGNIZED_TOKENS_#1'
            }
          });
        }
        if (
          !ctx.vr.codeDocument.text.substr(
            lastChild.offset + lastChild.length,
            endPos - lastChild.offset - lastChild.length
          )
            .match(/^\s*$/)
        ){
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.UNRECOGNIZED_TOKENS,
            message: `Unrecognized tokens`,
            startPos: ctx.vr.codeDocument.positionAt(lastChild.offset + lastChild.length),
            endPos: ctx.vr.codeDocument.positionAt( endPos ),
            node: rootFunctionCall.astNode as any,
            data:{
              code: 'UNRECOGNIZED_TOKENS_#2'
            }
          });
        }

      }
    }

    // validate followingNodes
    if (!ctx.vr.hasProblems()){
      followingNodes.forEach((one, index)=>{
        if (one instanceof AtSymbolNode){
          if (one!== atSymbolNode){
            ctx.vr.problems.push({
              severity: DiagnosticSeverity.Error,
              code: ErrorCode.INVALID_AT_SYMBOL,
              message: `Invalid symbol @`,
              startPos: ctx.vr.codeDocument.positionAt(one.offset),
              endPos: ctx.vr.codeDocument.positionAt(one.offset + one.length),
              node,
            });
          }
        }
      })
    }

  }else{
    nodes = childrenSyntaxNodes
    if (
      !ctx.vr.hasProblems()
    ){
      if (nodes.length> 0){
        // this part should not be reached unless lexical part failed
        // thus no harm to add this
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_ROOT_FUNCTION_CALL,
          message: `Invalid entry function call which missing a leading at symbol`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 0)),
          node,
        });
      }else{
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_ROOT_FUNCTION_CALL,
          message: `Invalid logic app entry expression`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 0)),
          node,
        });
      }
    }
  }

  return {
    ctx: returnCtx,
    nodes
  }
}

function _collect_identifiers_w_punctuation(
  ctx: ValidationIntermediateContext,
  nodes:SyntaxNode[],
  symbolChain:ReturnChainType[],
  vdPathChain: ValueDescriptionPath[],
  startIndex = 1
){
  const symbolArr = symbolChain.slice(startIndex);
  const ultimateSkippedVdPath = vdPathChain[startIndex -1];

  const vdArr:ValueDescriptionPath[] = vdPathChain.slice(startIndex);

  let curSymbol = symbolArr.shift();
  let previousSyntaxNode = nodes[nodes.length-1];
  let previousVdPath = ultimateSkippedVdPath;
  let curVdPath = vdArr.shift();

  while (!!curSymbol && !!curVdPath?.vd){

    if (
      curSymbol.type === "object-identifiers:wPunctuation" ||
      curSymbol.type === "identifiers:wPunctuation"
    ){
      const theIdentifierNodeWithPunctuation = new IdentifierNodeWithPunctuation(
        curSymbol.node,
        curSymbol.identifierName,
        curVdPath.vd as any,
        new AccessorPunctuator(curSymbol.node.children[0])
      );

      if (curVdPath.vd.isUnrecognizedReference()){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_FUNCTION_IDENTIFIER_CHAIN,
          message: `Unrecognized identifier ${curSymbol.identifierName}`,
          startPos: ctx.vr.codeDocument.positionAt(theIdentifierNodeWithPunctuation.offset),
          endPos: ctx.vr.codeDocument.positionAt(theIdentifierNodeWithPunctuation.offset+theIdentifierNodeWithPunctuation.length),
          node: theIdentifierNodeWithPunctuation.astNode as any,
        });
      }else if (previousVdPath.vd._$isOptional && !theIdentifierNodeWithPunctuation.isOptional){
        // check whether its accessor must be optional over here
        let startPos = previousSyntaxNode.offset;
        const endPos = previousSyntaxNode.offset + previousSyntaxNode.length + 1;
        let previousSyntaxNodeLabel = 'Return value';
        if (previousSyntaxNode instanceof FunctionCallNode){
          previousSyntaxNodeLabel = `The return value of function ${previousSyntaxNode.functionFullName}`;
        }else if (previousSyntaxNode instanceof IdentifierNode){
          previousSyntaxNodeLabel = previousSyntaxNode.identifierName;
          if (previousSyntaxNode instanceof IdentifierNodeWithPunctuation){
            startPos += previousSyntaxNode.isOptional? 2 : 1;
          }
        }

        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.IDENTIFIER_ACCESSOR_MUST_BE_OPTIONAL,
          message: `${previousSyntaxNodeLabel} might be null or undefined, suggest to use an optional accessor.`,
          startPos: ctx.vr.codeDocument.positionAt(startPos),
          endPos: ctx.vr.codeDocument.positionAt(endPos),
          node: previousSyntaxNode.astNode as any,
        });
      }else if (!previousVdPath.vd._$isOptional && theIdentifierNodeWithPunctuation.isOptional){
        // check whether its optional accessor is redundant or not
        const prefixAccessor = theIdentifierNodeWithPunctuation.prefixAccessor;
        const startPos = prefixAccessor.offset;
        const endPos = prefixAccessor.offset + prefixAccessor.length;
        let previousSyntaxNodeLabel = 'Return value';
        if (previousSyntaxNode instanceof FunctionCallNode){
          previousSyntaxNodeLabel = `The return value of the function ${previousSyntaxNode.functionFullName}`;
        }else if (previousSyntaxNode instanceof IdentifierNode){
          previousSyntaxNodeLabel = previousSyntaxNode.identifierName;
        }
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Hint,
          code: ErrorCode.IDENTIFIER_ACCESSOR_NEED_NOT_BE_OPTIONAL,
          message: `${previousSyntaxNodeLabel} is defined and its optional accessor might be redundant`,
          startPos: ctx.vr.codeDocument.positionAt(startPos),
          endPos: ctx.vr.codeDocument.positionAt(endPos),
          node: previousSyntaxNode.astNode as any,
          data: {
            optionalAccessorStartPos: theIdentifierNodeWithPunctuation.prefixAccessor.offset
          }
        });
      }
      // check if any mismatched cases found
      if(
        PackageDescription.CASE_MODE === 'CASE_INSENSITIVE_WITH_WARNINGS' &&
        curVdPath.name !== curSymbol.identifierName
      ){
        const problemOffset = theIdentifierNodeWithPunctuation.isOptional?
          theIdentifierNodeWithPunctuation.offset+2:
          theIdentifierNodeWithPunctuation.offset+1;
        const problemLength = theIdentifierNodeWithPunctuation.isOptional?
            theIdentifierNodeWithPunctuation.length-2:
            theIdentifierNodeWithPunctuation.length-1;
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Warning,
          code: ErrorCode.MISMATCHED_CASES_FOUND,
          message: `Identifier ${curSymbol.identifierName} would be regarded as ${curVdPath.name}`,
          startPos: ctx.vr.codeDocument.positionAt(problemOffset),
          endPos: ctx.vr.codeDocument.positionAt(problemOffset + problemLength),
          node: theIdentifierNodeWithPunctuation.astNode as any,
          source: curVdPath.name
        });
      }

      nodes.push(theIdentifierNodeWithPunctuation);
      previousSyntaxNode = theIdentifierNodeWithPunctuation;

    }else if (
      curSymbol.type === "array-literal" &&
      (curSymbol as any).isBracketNotation
    ){
      const _curSymbol = curSymbol as IdentifierInBracketNotationReturnChainType;
      // todo need injected vrCtx to validate and add problems if any

      const literalArrayNodeRes =  _do_parse(_curSymbol.node as any, ctx);
      if (
        literalArrayNodeRes.nodes.length === 1 &&
        literalArrayNodeRes.nodes[0] instanceof LiteralArrayNode
      ){
        const literalArrayNode = literalArrayNodeRes.nodes[0];
        const theIdentifierNodeInBracketNotation = new IdentifierNodeInBracketNotation(
          _curSymbol.node,
          _curSymbol.identifierName,
          _curSymbol.isPropertyLiteral,
          curVdPath.vd as any,
          literalArrayNodeRes.nodes[0]
        );
        nodes.push(theIdentifierNodeInBracketNotation);
        // alright need to validate the literal array node for bracketNotation
        if (literalArrayNode.itemSize !== 1){
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.INCORRECT_ITEM_SIZE_OF_BRACKET_NOTATION_IDENTIFIER,
            message: `The literal array bracket identifier expect exactly one item.`,
            startPos: ctx.vr.codeDocument.positionAt(literalArrayNode.offset),
            endPos: ctx.vr.codeDocument.positionAt(literalArrayNode.offset + literalArrayNode.length),
            node: literalArrayNode.astNode as any,
          });
        }else{
          const firstItem = literalArrayNode.item(0);
          if (firstItem){
            const oneIdChain = AbstractReturnChainType.findCompleteForwardIdentifiersChain(firstItem.astNode as any, ctx.vr.codeDocument);
            const sourceIdTyp = ctx.vr.globalSymbolTable.inferIdentifierTypeFromChain(ctx.vr.codeDocument, oneIdChain.chain);
            if (
              !(
                sourceIdTyp?.assignableTo(IdentifierType.String) ||
                sourceIdTyp?.assignableTo(IdentifierType.Number)
              )
            ){
              ctx.vr.problems.push({
                severity: DiagnosticSeverity.Error,
                code: ErrorCode.INCORRECT_FIRST_ITEM_TYPE_OF_BRACKET_NOTATION_IDENTIFIER,
                message: `The index type could only be of the string/number type.`,
                startPos: ctx.vr.codeDocument.positionAt(literalArrayNode.offset),
                endPos: ctx.vr.codeDocument.positionAt(literalArrayNode.offset + literalArrayNode.length),
                node: literalArrayNode.astNode as any,
              });
            }
          }else {
            ctx.vr.problems.push({
              severity: DiagnosticSeverity.Error,
              code: ErrorCode.INCORRECT_FIRST_ITEM_TYPE_OF_BRACKET_NOTATION_IDENTIFIER,
              message: `The index type cannot be empty.`,
              startPos: ctx.vr.codeDocument.positionAt(literalArrayNode.offset),
              endPos: ctx.vr.codeDocument.positionAt(literalArrayNode.offset + literalArrayNode.length),
              node: literalArrayNode.astNode as any,
            });
          }
        }
        // check if any mismatched cases found for a literal array of one literal property
        if(
          theIdentifierNodeInBracketNotation.literalArrayNode.itemSize &&
          _curSymbol.isPropertyLiteral &&
          !(
            previousVdPath.vd instanceof ReferenceValueDescription &&
            previousVdPath.vd._$valueType.type === IdentifierTypeName.ARRAY_OF_TYPE
          ) &&
          PackageDescription.CASE_MODE === 'CASE_INSENSITIVE_WITH_WARNINGS' &&
          curVdPath.name !== _curSymbol.identifierName
        ){
          const firstPara = theIdentifierNodeInBracketNotation.literalArrayNode.item(0)!;
          let problemOffset = firstPara.offset;
          let problemLength = firstPara.length;
          if (firstPara instanceof  LiteralStringNode){
            problemOffset += 1;
            problemLength -= 2;
          }
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Warning,
            code: ErrorCode.MISMATCHED_CASES_FOUND,
            message: `Literal property ${_curSymbol.identifierName} would be regarded as ${curVdPath.name}`,
            startPos: ctx.vr.codeDocument.positionAt(problemOffset),
            endPos: ctx.vr.codeDocument.positionAt(problemOffset + problemLength),
            node: theIdentifierNodeInBracketNotation.astNode as any,
            source: curVdPath.name
          });
        }

      }else {
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.UNRECOGNIZED_TOKENS,
          message: `Unrecognized identifiers, The index type was expected`,
          startPos: ctx.vr.codeDocument.positionAt(curSymbol.node.offset),
          endPos: ctx.vr.codeDocument.positionAt(curSymbol.node.offset + (curSymbol.node.length || 0)),
          node: curSymbol.node as any,
          data:{
            code: 'UNRECOGNIZED_TOKENS_#3'
          }
        });
      }
    }else{
      break;
    }

    curSymbol = symbolArr.shift();
    previousVdPath = curVdPath;
    curVdPath = vdArr.shift();
  }

}

function _collect_function_call_identifiers(
  functionCallNode: AzLogicAppNodeType<'function-call'>,
  ctx: ValidationIntermediateContext,
  functionDescPathChain: ValueDescriptionPath[],
):IdentifierNode[]{
  const result:IdentifierNode[] = [];
  const funCallParsedRes = _parse_children(functionCallNode, {...ctx});
  // check if any UNRECOGNIZED_TOKENS exist
  if (!ctx.vr.hasProblems()){
    const funCallTargetChildren = funCallParsedRes.nodes;
    if (
      funCallTargetChildren.length === 0 &&
      functionCallNode.length &&
      !ctx.vr.codeDocument.getNodeContent(functionCallNode)
        .match(/^\s*$/)
    ){
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.UNRECOGNIZED_TOKENS,
        message: `Unrecognized tokens`,
        startPos: ctx.vr.codeDocument.positionAt(functionCallNode.offset),
        endPos: ctx.vr.codeDocument.positionAt(functionCallNode.offset + functionCallNode.length),
        node: functionCallNode,
        data:{
          code: 'UNRECOGNIZED_TOKENS_#4'
        }
      });
    }else if (funCallTargetChildren.length){
      const startPos = functionCallNode.offset;
      const endPos = functionCallNode.offset + (functionCallNode.length || 0);
      const firstChild = funCallTargetChildren[0];
      const lastChild = funCallTargetChildren[funCallTargetChildren.length -1];
      if (
        !ctx.vr.codeDocument.text.substr(
          startPos,
          firstChild.offset - startPos
        )
          .match(/^\s*$/)
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.UNRECOGNIZED_TOKENS,
          message: `Unrecognized tokens`,
          startPos: ctx.vr.codeDocument.positionAt(startPos),
          endPos: ctx.vr.codeDocument.positionAt( firstChild.offset ),
          node: functionCallNode,
          data:{
            code: 'UNRECOGNIZED_TOKENS_#5'
          }
        });
      }
      if (
        !ctx.vr.codeDocument.text.substr(
          lastChild.offset + lastChild.length,
          endPos - lastChild.offset - lastChild.length
        )
          .match(/^\s*$/)
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.UNRECOGNIZED_TOKENS,
          message: `Unrecognized tokens`,
          startPos: ctx.vr.codeDocument.positionAt(lastChild.offset + lastChild.length),
          endPos: ctx.vr.codeDocument.positionAt( endPos ),
          node: functionCallNode,
          data:{
            code: 'UNRECOGNIZED_TOKENS_#6'
          }
        });
      }
    }
  }

  const lastFunDescPath = functionDescPathChain[functionDescPathChain.length - 1];

  if (!lastFunDescPath) return result;

  let index=0;
  while ( index < funCallParsedRes.nodes.length){
    const cur = funCallParsedRes.nodes[index];
    if (
      cur instanceof AccessorPunctuator
    ){
      if (
        index + 1 < funCallParsedRes.nodes.length &&
        funCallParsedRes.nodes[index+1] instanceof FunctionCallTarget
      ){

        const oneFunCallIdentifier = funCallParsedRes.nodes[index+1] as FunctionCallTarget;
        oneFunCallIdentifier.target = lastFunDescPath.vd;
        oneFunCallIdentifier.prefixAccessor = cur;
        result.push(oneFunCallIdentifier);
        index+=2;
      }else{
        break;
      }
    }else if (cur instanceof FunctionCallTarget){
      const theFunCallIdentifier = cur as FunctionCallTarget;
      theFunCallIdentifier.target = lastFunDescPath.vd;
      result.push(cur);
      index++;
      break;
    }else if (cur instanceof IdentifierNodeWithPunctuation){
      result.push(cur);
      index++;
    }else if (cur instanceof IdentifierNodeInBracketNotation){
      index++;
      break;
    }else if (cur instanceof IdentifierNode){
      result.push(cur);
      index++;
    }else {
      index++;
      break;
    }
  }

  return result;
}

function _parse_identifiers(node: AzLogicAppNode, ctx: ValidationIntermediateContext):ParserRes{
  // the node must be either an identifier or obj-identifier node
  const nodes:SyntaxNode[] = [];
  const returnCtx = {...ctx};

  const postIdChain = AbstractReturnChainType.findCompleteForwardIdentifiersChain(node, ctx.vr.codeDocument);
  if (postIdChain.chain.length) {

    returnCtx.skipIndices = postIdChain.chain.length -1 ;
    const vdPathArr = ctx.vr.globalSymbolTable.findValDescArrFromChain(ctx.vr.codeDocument, postIdChain.chain);

    // convert identifiers chain to nodes
    if (
      vdPathArr.length &&
      !(
        vdPathArr[0].vd instanceof ReferenceValueDescription &&
        vdPathArr[0].vd._$valueType === IdentifierType.UNRECOGNIZED
      )
    ){
      // push one identifier node into nodes
      const theIdentifierNode = new IdentifierNode(
        node,
        (postIdChain.chain[0] as IdentifierReturnChainType).identifierName,
        vdPathArr[0].vd
      );
      nodes.push(theIdentifierNode);
      if(
        vdPathArr[0].vd._$type === DescriptionType.OverloadedFunctionValue ||
        vdPathArr[0].vd._$type === DescriptionType.FunctionValue
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_IDENTIFIER_CHAIN,
          message: `Missing invocation of the function`,
          startPos: ctx.vr.codeDocument.positionAt(theIdentifierNode.offset),
          endPos: ctx.vr.codeDocument.positionAt(theIdentifierNode.offset + theIdentifierNode.length),
          node,
        });
      }

      _collect_identifiers_w_punctuation(ctx, nodes, postIdChain.chain, vdPathArr);

      const lastVd = vdPathArr[vdPathArr.length -1].vd;
      if(
        lastVd._$type === DescriptionType.OverloadedFunctionValue ||
        lastVd._$type === DescriptionType.FunctionValue
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_IDENTIFIER_CHAIN,
          message: `Missing invocation of the function`,
          startPos: ctx.vr.codeDocument.positionAt(postIdChain.head.offset),
          endPos: ctx.vr.codeDocument.positionAt(postIdChain.tail.offset + (postIdChain.tail.length || 0)),
          node,
        });
      }

    }else{
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.INVALID_IDENTIFIER_CHAIN,
        message: `Unrecognized identifiers`,
        startPos: ctx.vr.codeDocument.positionAt(postIdChain.head.offset),
        endPos: ctx.vr.codeDocument.positionAt(postIdChain.tail.offset + (postIdChain.tail.length || 0)),
        node,
      });
    }
  } else {
    // unrecognized identifier node
    ctx.vr.problems.push({
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.INVALID_IDENTIFIER,
      message: `Unrecognized identifier`,
      startPos: ctx.vr.codeDocument.positionAt(postIdChain.head.offset),
      endPos: ctx.vr.codeDocument.positionAt(postIdChain.tail.offset + (postIdChain.tail.length || 0)),
      node,
    });
  }

  return {
    ctx: returnCtx,
    nodes
  }
}

function _parse_function_call_target(node: AzLogicAppNode, ctx: ValidationIntermediateContext):ParserRes{
  const nodes:SyntaxNode[] = [];
  const returnCtx = {...ctx};

  if (node.$impostureLang?.dataType === 'function-call-target'){
    nodes.push(new FunctionCallTarget(
      node,
      ctx.vr.codeDocument.getNodeContent(node),
      // todo fix this seize its type
      undefined,
    ))
  }

  return {
    ctx: returnCtx,
    nodes
  }
}

function _parse_function_call_complete(node: AzLogicAppNode, ctx: ValidationIntermediateContext):ParserRes{
  const nodes:SyntaxNode[] = [];
  const returnCtx = {...ctx, hasFunctionCall: true};

  if (node.$impostureLang?.dataType === 'function-call-complete'){
    let wrappedInRootAndPrecededByAtSymbol = false;
    if (ctx.directWrapperType === WrapperType.ROOT_FUNCTION_CALL) {
      const theElderSibling = node.findAnElderSibling();
      //check valid root fun-call-complete or not
      if (!theElderSibling || theElderSibling.$impostureLang?.dataType !== 'atSymbol') {
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_FUNCTION_PATTERN,
          message: `Miss a preceding @ for the function call at root statement`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 0)),
          node,
        });
        return {
          ctx: returnCtx,
          nodes: nodes
        };
      }
      wrappedInRootAndPrecededByAtSymbol = true;
    }

    // check the content of the fun-call-complete
    if (
      node.children?.length === 2 &&
      node.children[0]?.$impostureLang?.dataType === 'function-call' &&
      node.children[1]?.$impostureLang?.dataType === 'parentheses'
    ) {
      const functionCallNode = node.children[0] as AzLogicAppNodeType<'function-call'>;
      const parenthesesNode = node.children[1] as AzLogicAppNodeType<'parentheses'>;
      const functionCallFullNameContent = ctx.vr.codeDocument.getNodeContent(functionCallNode);
      const functionCallFullName = AzLogicAppNodeUtils.getFunctionCallFullname(functionCallNode, ctx.vr.codeDocument);
      const functionCallPaths = functionCallFullName.split('.');
      const functionDescPathArr = ctx.vr.globalSymbolTable.findAllByPath(functionCallPaths);
      // phase two todo: emmm.... the supportFunctionCallIdentifiers could be seized in a more elegant way
      const supportFunctionCallIdentifiers = _collect_function_call_identifiers(
        node.children[0] as any,
        ctx,
        functionDescPathArr
      );
      const functionDescPath = functionDescPathArr[functionDescPathArr.length-1];
      if (
        !functionDescPath?.vd ||
        (
          !(functionDescPath.vd instanceof FunctionValueDescription) &&
          !(functionDescPath.vd instanceof OverloadedFunctionValueDescription)
        )
      ) {
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.UNKNOWN_FUNCTION_NAME,
          message: `Unknown function name`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset +
            (wrappedInRootAndPrecededByAtSymbol? -1 : 0)
          ),
          endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 0)),
          node,
        });
      }else{
        let retTyp: IdentifierType | undefined = undefined;
        if (functionDescPath.vd instanceof FunctionValueDescription){
          retTyp = functionDescPath.vd._$returnType;
        }else{
          retTyp = functionDescPath.vd._$returnType[0];
        }
        const parenthesesParsedRes = _do_parse(parenthesesNode,
          {
            ...ctx,
            directWrapperType: WrapperType.FUNCTION_PARENTHESES,
            needOneSeparator: false
          }
        );

        // let's create a function syntax node, no matter its parameters were valid or not
        if (
          parenthesesParsedRes.nodes.length ===1 &&
          parenthesesParsedRes.nodes[0] instanceof ParenthesisNode
        ){
          const parenthesesSyntaxNode = parenthesesParsedRes.nodes[0] as ParenthesisNode;
          let paraSeq = 0;
          Object.assign(returnCtx, parenthesesParsedRes.ctx);
          // first ensure we gotta no problems beneath our parameter children
          // then check parameter types
          if (!ctx.vr.hasProblems()){
            let parameterTypes: IdentifierType[] | undefined = undefined;
            // determine the param list
            if (
              functionDescPath.vd instanceof OverloadedFunctionValueDescription &&
              functionDescPath.vd._$parameterTypes.length
            ) {
              paraSeq = ctx.vr.globalSymbolTable.determineOverloadFunParamSeq(ctx.vr.codeDocument, node, functionDescPath.vd);
              // todo investigate why functionDescPath.vd._$parameterTypes[paraSeq] might be undefined in the runtime
              if (paraSeq >=0 && paraSeq<functionDescPath.vd._$parameterTypes.length){
                parameterTypes = functionDescPath.vd._$parameterTypes[paraSeq].slice();
                retTyp = functionDescPath.vd._$returnType[paraSeq];
              }else if(functionDescPath.vd._$parameterTypes.length){
                paraSeq = 0;
                parameterTypes = functionDescPath.vd._$parameterTypes[0].slice();
                retTyp = functionDescPath.vd._$returnType[0];
              }
            } else if (
              functionDescPath.vd instanceof FunctionValueDescription &&
              Array.isArray(functionDescPath.vd._$parameterTypes) &&
              functionDescPath.vd._$returnType
            ) {
              // regular function
              // todo investigate why functionDescPath.vd._$parameterTypes could be undefined in the runtime
              parameterTypes = functionDescPath.vd._$parameterTypes.slice();
              retTyp = functionDescPath.vd._$returnType;
            }
            // the whole process below were enhanced by using concrete syntax nodes
            // stop using parenthesesNode
            // check the function parameters
            // parameterTypes should be defined and of array type or there might be severer grammar flaws
            if (Array.isArray(parameterTypes)) {
              // check function parameter cnt matches or not
              const curParenthesesChildrenCnt = parenthesesSyntaxNode.content.length;
              const confParamCnt = parameterTypes.length;
              const curParamCnt = parenthesesSyntaxNode.parameterSize;

              if (
                (curParenthesesChildrenCnt !== 0 || confParamCnt !== 0) &&
                !parameterTypes.some((onePara) => onePara.isVarList) &&
                (curParamCnt !== confParamCnt || curParenthesesChildrenCnt < confParamCnt * 2 - 1)
              ) {
                ctx.vr.problems.push({
                  severity: DiagnosticSeverity.Error,
                  code: ErrorCode.FUNCTION_PARAMETER_COUNT_MISMATCHES,
                  message: `The function call lacked or had more parameters required`,
                  startPos: ctx.vr.codeDocument.positionAt(
                    node.offset +
                    (wrappedInRootAndPrecededByAtSymbol? -1 : 0)
                  ),
                  endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 0)),
                  node,
                });
              } else {
                if (curParamCnt && parenthesesSyntaxNode.content) {
                  // iterate, seize and validate param return type
                  let paraIndex = 0;
                  while (paraIndex < curParamCnt) {
                    let match = false;
                    let mismatchSrcTyp: IdentifierType | undefined;
                    let mismatchTargetTyp: IdentifierType | undefined;
                    const oneParaSynNode = parenthesesSyntaxNode.parameter(paraIndex);
                    if (oneParaSynNode) {
                      const sourceIdTyp = oneParaSynNode.returnType
                      const targetIdType = parameterTypes[paraIndex];
                      if (targetIdType.isVarList) {
                        IdentifierType.populateVarParaIncreasingly(parameterTypes, paraIndex);
                      }
                      // check it equals or match the target id typ
                      match =
                        (
                          targetIdType.type === IdentifierTypeName.CONSTANT &&
                            oneParaSynNode instanceof LiteralValueNode &&
                          (
                            (
                              typeof targetIdType.constantValue === 'string' &&
                              targetIdType.constantStringValue === oneParaSynNode.returnValue?._$value
                            )||
                            (
                              targetIdType.constantValue === oneParaSynNode.returnValue?._$value
                            )
                          )
                        ) ||
                        !!sourceIdTyp?.assignableTo(targetIdType);
                      if (!match) {
                        mismatchSrcTyp = sourceIdTyp;
                        mismatchTargetTyp = targetIdType;
                      }
                    }
                    if (!match) {
                      ctx.vr.problems.push({
                        severity: DiagnosticSeverity.Error,
                        code: ErrorCode.FUNCTION_PARAMETER_TYPE_MISMATCHES,
                        message: `Cannot fit ${
                          mismatchSrcTyp ? mismatchSrcTyp.label : 'empty'
                        } into the function parameter ${mismatchTargetTyp ? mismatchTargetTyp.label : 'empty'}.`,
                        startPos: ctx.vr.codeDocument.positionAt(parenthesesSyntaxNode.startPosOfParameter(paraIndex)),
                        endPos: ctx.vr.codeDocument.positionAt(parenthesesSyntaxNode.endPosOfParameter(paraIndex)),
                        node,
                      });
                      break;
                    }
                    paraIndex++;
                  }
                }
              }
            }else{
              // logically it should not reach over here, parameterTypes should always be a no-empty array
              // thus if we reached here, we gonna log something over here,
              AzLogicAppLangConstants.inSyntaxDebugMode &&
                console.log("[azLgcLang::invalid_function_desc]", functionCallFullNameContent, functionDescPath.name, functionDescPath.vd);
              AzLogicAppLangConstants.globalTraceHandler && AzLogicAppLangConstants.globalTraceHandler("[azLgcLang::invalid_function_desc]", {
                functionFullName: functionCallFullNameContent,
                functionDescriptionPath: functionDescPath.name,
              })
            }
          }

          // directly put fun ref into the corresponding ref vd
          let targetDesc = functionDescPath.vd as ValueDescription;
          if ( retTyp?.type ===  IdentifierTypeName.INTERNAL_FUN_REF){
            targetDesc = ctx.vr.globalSymbolTable.findByPath(retTyp.returnTypeChainList!)!
          }

          const theFunctionCallNode = new FunctionCallNode(
            node,
            functionCallFullName,
            functionDescPath.vd,
            supportFunctionCallIdentifiers,
            targetDesc,
            parenthesesParsedRes.nodes[0],
            paraSeq
          );
          nodes.push(theFunctionCallNode);

          // todo need to check if any mismatched cases existed
          const expectedFunctionCallTargetContent = ValueDescriptionPath.buildPathString(functionDescPathArr);
          if (
            PackageDescription.CASE_MODE === "CASE_INSENSITIVE_WITH_WARNINGS" &&
            expectedFunctionCallTargetContent != functionCallFullNameContent
          ){
            ctx.vr.problems.push({
              severity: DiagnosticSeverity.Warning,
              code: ErrorCode.MISMATCHED_CASES_FOUND,
              message: `Function call target ${functionCallFullNameContent} would be regarded as ${expectedFunctionCallTargetContent}`,
              startPos: ctx.vr.codeDocument.positionAt(theFunctionCallNode.targetOffset),
              endPos: ctx.vr.codeDocument.positionAt(theFunctionCallNode.targetOffset + theFunctionCallNode.targetLength),
              node: theFunctionCallNode.astNode as any,
              source: expectedFunctionCallTargetContent
            });
          }

        }

        // need to decide whether we need populate the post identifier nodes over here
        const postFunCallChain = AbstractReturnChainType.findCompleteForwardIdentifiersChain(node, ctx.vr.codeDocument);
        if (postFunCallChain.chain.length > 1) {
          returnCtx.skipIndices = postFunCallChain.chain.length -1 ;
          // alright we did have a chain longer than one, and need to populate it
          const chainVds = ctx.vr.globalSymbolTable.findValDescArrFromChain(ctx.vr.codeDocument, postFunCallChain.chain);
          if (chainVds.length){
            _collect_identifiers_w_punctuation(
              ctx,
              nodes,
              postFunCallChain.chain,
              chainVds
            )
          }else{
            ctx.vr.problems.push({
              severity: DiagnosticSeverity.Error,
              code: ErrorCode.INVALID_FUNCTION_IDENTIFIER_CHAIN,
              message: `Unrecognized identifiers`,
              startPos: ctx.vr.codeDocument.positionAt(postFunCallChain.head.offset + postFunCallChain.head.length || 0),
              endPos: ctx.vr.codeDocument.positionAt(postFunCallChain.tail.offset + (postFunCallChain.tail.length || 0)),
              node,
            });
          }
        }

      }
    }else{
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.INVALID_FUNCTION_PATTERN,
        message: `Invalid function pattern`,
        startPos: ctx.vr.codeDocument.positionAt(
          node.offset +
          (wrappedInRootAndPrecededByAtSymbol? -1 : 0)
        ),
        endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 0)),
        node,
      });
    }
  }

  return {
    ctx: returnCtx,
    nodes
  }
}

function _parse_at_template_sub_element(node: AzLogicAppNode, ctx: ValidationIntermediateContext):ParserRes{
  const nodes:SyntaxNode[] = [];
  const returnCtx = {...ctx};

  const templateContentRes = _parse_children(node, {...ctx, directWrapperType: WrapperType.CURLY_BRACKETS})
  const expressionTemplate = new ExpressionTemplateNode(
    node,
    templateContentRes.nodes
  );

  Object.assign(returnCtx, templateContentRes.ctx);

  nodes.push(expressionTemplate)

  // check if any UNRECOGNIZED_TOKENS exist
  if(!ctx.vr.hasProblems()){
    const templateChildren = templateContentRes.nodes;
    if(
      templateChildren.length === 0 &&
      expressionTemplate.length >3 &&
      !ctx.vr.codeDocument.text.substr(expressionTemplate.offset + 2, expressionTemplate.length -3)
        .match(/^\s*$/)
    ){
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.UNRECOGNIZED_TOKENS,
        message: `Unrecognized tokens`,
        startPos: ctx.vr.codeDocument.positionAt(expressionTemplate.offset + 2),
        endPos: ctx.vr.codeDocument.positionAt(expressionTemplate.offset + expressionTemplate.length -1),
        node,
        data:{
          code: 'UNRECOGNIZED_TOKENS_#7'
        }
      });
    }else if (
      templateChildren.length
    ){
      const startPos = expressionTemplate.offset + 2;
      const endPos = expressionTemplate.offset + expressionTemplate.length -1;
      const firstChild = templateChildren[0];
      const lastChild = templateChildren[templateChildren.length -1];
      if (
        !ctx.vr.codeDocument.text.substr(
          startPos,
          firstChild.offset - startPos
        )
          .match(/^\s*$/)
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.UNRECOGNIZED_TOKENS,
          message: `Unrecognized tokens`,
          startPos: ctx.vr.codeDocument.positionAt(startPos),
          endPos: ctx.vr.codeDocument.positionAt( firstChild.offset ),
          node,
          data:{
            code: 'UNRECOGNIZED_TOKENS_#8'
          }
        });
      }
      if (
        !ctx.vr.codeDocument.text.substr(
          lastChild.offset + lastChild.length,
          endPos - lastChild.offset - lastChild.length
        )
          .match(/^\s*$/)
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.UNRECOGNIZED_TOKENS,
          message: `Unrecognized tokens`,
          startPos: ctx.vr.codeDocument.positionAt(lastChild.offset + lastChild.length),
          endPos: ctx.vr.codeDocument.positionAt( endPos ),
          node,
          data:{
            code: 'UNRECOGNIZED_TOKENS_#9'
          }
        });
      }
    }
  }

  return {
    ctx: returnCtx,
    nodes
  }
}

function _parse_literal_array(node: AzLogicAppNode, ctx: ValidationIntermediateContext):ParserRes{

  const nodes:SyntaxNode[] = [];
  const returnCtx = {...ctx, hasFunctionCall: true, directWrapperType: WrapperType.LITERAL_ARRAY};

  const literalArrContentParsedRes = _parse_children(node, returnCtx);
  const literalArrayNode = new LiteralArrayNode(node, literalArrContentParsedRes.nodes);
  // todo should we ignore the ctx returned by the literalArrContentParsedRes, emmm think about it
  // Object.assign(returnCtx, literalArrContentParsedRes.ctx);
  nodes.push(literalArrayNode);
  // need not to validate the content array were seperated by commas correctly, expression validation would do the job
  // check if any UNRECOGNIZED_TOKENS exist
  if (!ctx.vr.hasProblems()){
    const literalArrayChildren = literalArrContentParsedRes.nodes;
    if (
      literalArrayChildren.length === 0 &&
      literalArrayNode.length > 2 &&
      !ctx.vr.codeDocument.text.substr(literalArrayNode.offset+1, literalArrayNode.length -2)
        .match(/^\s*$/)
    ){
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.UNRECOGNIZED_TOKENS,
        message: `Unrecognized tokens`,
        startPos: ctx.vr.codeDocument.positionAt(literalArrayNode.offset + 1),
        endPos: ctx.vr.codeDocument.positionAt(literalArrayNode.offset + literalArrayNode.length - 1),
        node,
        data:{
          code: 'UNRECOGNIZED_TOKENS_#10'
        }
      });
    }else if (literalArrayChildren.length){
      const startPos = literalArrayNode.offset + 1;
      const endPos = literalArrayNode.offset + literalArrayNode.length - 1;
      const firstChild = literalArrayChildren[0];
      const lastChild = literalArrayChildren[literalArrayChildren.length -1];
      if (
        !ctx.vr.codeDocument.text.substr(
          startPos,
          firstChild.offset - startPos
        )
          .match(/^\s*$/)
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.UNRECOGNIZED_TOKENS,
          message: `Unrecognized tokens`,
          startPos: ctx.vr.codeDocument.positionAt(startPos),
          endPos: ctx.vr.codeDocument.positionAt( firstChild.offset ),
          node,
          data:{
            code: 'UNRECOGNIZED_TOKENS_#11'
          }
        });
      }
      if (
        !ctx.vr.codeDocument.text.substr(
          lastChild.offset + lastChild.length,
          endPos - lastChild.offset - lastChild.length
        )
          .match(/^\s*$/)
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.UNRECOGNIZED_TOKENS,
          message: `Unrecognized tokens`,
          startPos: ctx.vr.codeDocument.positionAt(lastChild.offset + lastChild.length),
          endPos: ctx.vr.codeDocument.positionAt( endPos ),
          node,
          data:{
            code: 'UNRECOGNIZED_TOKENS_#12'
          }
        });
      }
    }

  }

  returnCtx.needOneSeparator = true;
  returnCtx.precedingPeerIdentifierExist = true;

  return {
    ctx: returnCtx,
    nodes
  }
}

/**
 * parse an array of AzLogicAppNode into Syntax nodes
 * and _parse_children won't populate the parent fields of those children, which should be handled the caller
 * @param node
 * @param ctx
 */
function _parse_children(node: AzLogicAppNode, ctx: ValidationIntermediateContext):ParserRes{
  const nodes:SyntaxNode[] = [];
  const returnCtx = {...ctx};

  let needOneSeparator = false;
  let precedingPeerIdentifierExist = false;
  let precedingPeerTemplateExist = false;
  if (node.children && node.children.length) {
    let index = 0;
    while (index < node.children.length) {
      const oneParsedRes = _do_parse(node.children[index] as AzLogicAppNode, {
        ...ctx,
        needOneSeparator,
        precedingPeerIdentifierExist,
        precedingPeerTemplateExist,
      })
      const oneVrCtx = oneParsedRes.ctx;
      const nodeArr = oneParsedRes.nodes;

      // we gotta node
      if (!!nodeArr.length){
        while (nodeArr.length){
          const oneNode = nodeArr.shift()!;
          // handle elder and younger siblings for the oneParsedRes.node
          if (nodes.length){
            // more than one node pushed already
            const lastNode = nodes[nodes.length-1];
            lastNode.youngerSibling = oneNode;
            oneNode.elderSibling = lastNode;
            if (
              ctx.directWrapperType !== WrapperType.ROOT &&
              lastNode.offset + lastNode.length !== oneNode.offset &&
              !ctx.vr.codeDocument.text.substr(
                lastNode.offset + lastNode.length, oneNode.offset -lastNode.offset - lastNode.length
              )
                .match(/^\s*$/)
            ){
              ctx.vr.problems.push({
                severity: DiagnosticSeverity.Error,
                code: ErrorCode.UNRECOGNIZED_TOKENS,
                message: `Unrecognized tokens`,
                startPos: ctx.vr.codeDocument.positionAt(lastNode.offset + lastNode.length),
                endPos: ctx.vr.codeDocument.positionAt(oneNode.offset),
                node,
                data:{
                  code: 'UNRECOGNIZED_TOKENS_#13'
                }
              });
            }
          }
          // push the first node or linked node
          nodes.push(oneNode);
        }
      }

      // handle the validation context
      needOneSeparator = !!oneVrCtx.needOneSeparator && ctx.directWrapperType !== WrapperType.CURLY_BRACKETS;
      delete oneVrCtx.needOneSeparator;
      precedingPeerIdentifierExist = precedingPeerIdentifierExist || !!oneVrCtx.precedingPeerIdentifierExist;
      delete oneVrCtx.precedingPeerIdentifierExist;
      precedingPeerTemplateExist = precedingPeerTemplateExist || !!oneVrCtx.precedingPeerTemplateExist;
      delete oneVrCtx.precedingPeerTemplateExist;
      if (oneVrCtx.skipIndices) {
        index += oneVrCtx.skipIndices;
        delete oneVrCtx.skipIndices;
      }
      Object.assign(returnCtx, oneVrCtx);
      index++;
    }
  }
  return {
    ctx: returnCtx,
    nodes
  }
}

function _do_parse(node: AzLogicAppNode, ctx: ValidationIntermediateContext):ParserRes{
  let returnCtx = {...ctx};
  let nodes: SyntaxNode[] = [];

  if (
    ctx.needOneSeparator &&
    (node?.$impostureLang?.dataType === 'function-call-complete' ||
      node?.$impostureLang?.dataType === 'identifiers' ||
      node?.$impostureLang?.dataType === 'object-identifiers' ||
      node?.$impostureLang?.dataType === 'parentheses' ||
      node?.$impostureLang?.dataType === 'number' ||
      node?.$impostureLang?.dataType === 'string' ||
      node?.$impostureLang?.dataType === 'boolean' ||
      node?.$impostureLang?.dataType === 'null')
  ) {
    ctx.vr.problems.push({
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.NEED_PRECEDING_SEPARATOR,
      message: `Miss a preceding comma`,
      startPos: ctx.vr.codeDocument.positionAt(node.offset),
      endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 1)),
      node,
    });
  }

  switch (node?.$impostureLang?.dataType) {
    case 'punctuation':
    {
      const theAccessorPunctuator = new AccessorPunctuator(node);
      nodes.push(theAccessorPunctuator);
      // we might have a standalone AccessorPunctuator, like: @pipeline().globalParameters?.|
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.INVALID_STANDALONE_ACCESSOR,
        message: `Invalid standalone accessor`,
        startPos: ctx.vr.codeDocument.positionAt(theAccessorPunctuator.offset),
        endPos: ctx.vr.codeDocument.positionAt(theAccessorPunctuator.offset + theAccessorPunctuator.length),
        node,
      });
    }
      break;
    case 'root-function-call-expression':
    {
      const rootFunCallExpRes = _parse_root_function_call(node, returnCtx);
      returnCtx = rootFunCallExpRes.ctx;
      nodes = rootFunCallExpRes.nodes;
    }
      break;
    case 'dualAtSymbol':
      nodes.push(new EscapedAtSymbolNode(node));
      break;
    case 'atSymbol':
      // create one atSymbol node
      nodes.push(new AtSymbolNode(node));
      // function `_parse_root_function_call` would check whether it is a valid atSymbol or not once returned
      break;
    case 'atTemplateSubstitutionElement':
    {
      const atTemplateSubElementRes = _parse_at_template_sub_element(node, returnCtx);
      returnCtx = atTemplateSubElementRes.ctx;
      nodes = atTemplateSubElementRes.nodes;
      if (!ctx.vr.hasProblems()){
        if (ctx.directWrapperType === WrapperType.CURLY_BRACKETS) {
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.INVALID_NESTED_TEMPLATE,
            message: `A template cannot nest each other`,
            startPos: ctx.vr.codeDocument.positionAt(node.offset),
            endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 1)),
            node,
          });
        } else if (ctx.directWrapperType === WrapperType.ROOT && ctx.precedingPeerIdentifierExist) {
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.INVALID_TEMPLATE,
            message: `A string template cannot succeed an identifier within the root statement`,
            startPos: ctx.vr.codeDocument.positionAt(node.offset),
            endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 1)),
            node,
          });
        }
      }
      returnCtx.precedingPeerTemplateExist = true;
    }
      break;
    case 'function-call-target':
    {
      const functionCallTargetRes = _parse_function_call_target(node, returnCtx);
      returnCtx = functionCallTargetRes.ctx;
      nodes = functionCallTargetRes.nodes;
    }
      break;
    case 'function-call-complete':
    {

      const functionCallCompleteRes = _parse_function_call_complete(node, returnCtx);
      returnCtx = functionCallCompleteRes.ctx;
      nodes = functionCallCompleteRes.nodes;

      // if (!ctx.vr.hasProblems()){
        if (ctx.directWrapperType === WrapperType.ROOT_FUNCTION_CALL && ctx.precedingPeerTemplateExist) {
          // todo remove it?
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.INVALID_MULTIPLE_EXPRESSION,
            message: `An identifier cannot succeed a template string within the root statement`,
            startPos: ctx.vr.codeDocument.positionAt(node.offset),
            endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 1)),
            node,
          });
        } else if (
          (ctx.directWrapperType === WrapperType.ROOT_FUNCTION_CALL || ctx.directWrapperType === WrapperType.CURLY_BRACKETS) &&
          ctx.precedingPeerIdentifierExist
        ) {
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.INVALID_MULTIPLE_EXPRESSION,
            message: `Cannot have multiple identifiers within the ${
              ctx.directWrapperType === WrapperType.ROOT_FUNCTION_CALL ? 'root statement' : 'curly brackets'
            }`,
            startPos: ctx.vr.codeDocument.positionAt(node.offset),
            endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 1)),
            node,
          });
        }
      // }

      returnCtx.needOneSeparator = true;
      returnCtx.precedingPeerIdentifierExist = true;
    }
      break;
    case 'identifiers':
    case 'object-identifiers':
    {
      const identifiersRes = _parse_identifiers(node, returnCtx);
      returnCtx = identifiersRes.ctx;
      nodes = identifiersRes.nodes;

      if (!ctx.vr.hasProblems()){
        if (
          (ctx.directWrapperType === WrapperType.ROOT_FUNCTION_CALL || ctx.directWrapperType === WrapperType.CURLY_BRACKETS) &&
          ctx.precedingPeerIdentifierExist
        ) {
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.INVALID_MULTIPLE_EXPRESSION,
            message: `Cannot have multiple identifiers within the ${
              ctx.directWrapperType === WrapperType.ROOT_FUNCTION_CALL ? 'root statement' : 'curly brackets'
            }`,
            startPos: ctx.vr.codeDocument.positionAt(node.offset),
            endPos: ctx.vr.codeDocument.positionAt(node.offset + (node.length || 1)),
            node,
          });
        }
      }

      if(nodes.length){
        returnCtx.needOneSeparator = true;
        returnCtx.precedingPeerIdentifierExist = true;
      }

    }
      break;
    case 'parentheses':
    {
      const parenthesesChildrenRes = _parse_children(node, ctx);
      const parenthesesChildren = parenthesesChildrenRes.nodes;
      Object.assign(returnCtx, parenthesesChildrenRes.ctx);
      returnCtx.needOneSeparator = true;
      returnCtx.precedingPeerIdentifierExist = true;
      const parenthesisNode = new ParenthesisNode(node, parenthesesChildren);
      nodes.push(parenthesisNode);
      if (!ctx.vr.hasProblems()){
        if(
          parenthesesChildren.length === 0 &&
          parenthesisNode.length > 2 &&
          !ctx.vr.codeDocument.text.substr(
            parenthesisNode.offset + 1, parenthesisNode.length - 2
          )
            .match(/^\s*$/)
        ){
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.UNRECOGNIZED_TOKENS,
            message: `Unrecognized tokens`,
            startPos: ctx.vr.codeDocument.positionAt(parenthesisNode.offset + 1),
            endPos: ctx.vr.codeDocument.positionAt(parenthesisNode.offset + parenthesisNode.length -1),
            node,
            data:{
              code: 'UNRECOGNIZED_TOKENS_#14'
            }
          });
        }else if (parenthesesChildren.length){
          if (
            !ctx.vr.codeDocument.text.substr(
              parenthesisNode.offset + 1, parenthesesChildren[0].offset - parenthesisNode.offset - 1
            )
              .match(/^\s*$/)
          ){
            ctx.vr.problems.push({
              severity: DiagnosticSeverity.Error,
              code: ErrorCode.UNRECOGNIZED_TOKENS,
              message: `Unrecognized tokens`,
              startPos: ctx.vr.codeDocument.positionAt(parenthesisNode.offset + 1),
              endPos: ctx.vr.codeDocument.positionAt( parenthesesChildren[0].offset ),
              node,
              data:{
                code: 'UNRECOGNIZED_TOKENS_#15'
              }
            });
          }
          if (
            !ctx.vr.codeDocument.text.substr(
              parenthesesChildren[parenthesesChildren.length -1].offset + parenthesesChildren[parenthesesChildren.length -1].length,
              parenthesisNode.offset + parenthesisNode.length - 1 -
              ( parenthesesChildren[parenthesesChildren.length -1].offset + parenthesesChildren[parenthesesChildren.length -1].length )
            )
              .match(/^\s*$/)
          ){
            ctx.vr.problems.push({
              severity: DiagnosticSeverity.Error,
              code: ErrorCode.UNRECOGNIZED_TOKENS,
              message: `Unrecognized tokens`,
              startPos: ctx.vr.codeDocument.positionAt(
                parenthesesChildren[parenthesesChildren.length -1].offset + parenthesesChildren[parenthesesChildren.length -1].length
              ),
              endPos: ctx.vr.codeDocument.positionAt(
                parenthesisNode.offset + parenthesisNode.length - 1
              ),
              node,
              data:{
                code: 'UNRECOGNIZED_TOKENS_#16'
              }
            });
          }
        }
      }
    }
      break;
    case 'number':
      returnCtx.needOneSeparator = true;
      returnCtx.precedingPeerIdentifierExist = true;
      nodes.push(new LiteralNumberNode(node, LiteralNumberNode.StringToNumber(
        returnCtx.vr.codeDocument.getNodeContent(node)
      )));
      break;
    case 'string':{
      returnCtx.needOneSeparator = true;
      returnCtx.precedingPeerIdentifierExist = true;
      const theLiteralStringNode = new LiteralStringNode(node, returnCtx.vr.codeDocument.getNodeContent(node));
      nodes.push(theLiteralStringNode);
      if (theLiteralStringNode.isDoubleQuoted()){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.Q_STRING_DOUBLE_IS_NOT_ALLOWED,
          message: `Double quoted string is not allowed`,
          startPos: ctx.vr.codeDocument.positionAt(
            theLiteralStringNode.offset
          ),
          endPos: ctx.vr.codeDocument.positionAt(
            theLiteralStringNode.offset + theLiteralStringNode.length
          ),
          node: theLiteralStringNode.astNode as any,
        });
      }
    }
      break;
    case 'boolean':
      returnCtx.needOneSeparator = true;
      returnCtx.precedingPeerIdentifierExist = true;
      nodes.push(new LiteralBooleanNode(node, LiteralBooleanNode.StringToBoolean(
        returnCtx.vr.codeDocument.getNodeContent(node)
      )));
      break;
    case 'null':
      returnCtx.needOneSeparator = true;
      returnCtx.precedingPeerIdentifierExist = true;
      nodes.push(new LiteralNullNode(node));
      break;
    case 'array-literal':
    {
      const literalArrRes = _parse_literal_array(node, returnCtx);
      returnCtx = literalArrRes.ctx;
      nodes = literalArrRes.nodes;
    }
      break;
    case 'comma':
      returnCtx.needOneSeparator = false;
      nodes.push(new CommaPunctuator(node));
      break;
    default:
      // noop
      break;
  }
  return {
    ctx: returnCtx,
    nodes
  }
}

export function parseAzLgcExpDocument(
  codeDocument:CodeDocument,
  globalSymbolTable:SymbolTable
){
  let result:AzLgcExpDocument|undefined
  const vr = new ValidateResult(codeDocument, globalSymbolTable);
  if (codeDocument.root?.type === 'IncludeOnlyRule') {
    // no need to check any UNRECOGNIZED_TOKENS exist beneath the root entry level
    const res = _parse_children(codeDocument.root as any, {vr, directWrapperType: WrapperType.ROOT});
    result = new AzLgcExpDocument(codeDocument, res.nodes, vr);
  }
  return result;
}
