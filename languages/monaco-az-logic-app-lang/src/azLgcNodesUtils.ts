import {ASTNode, CodeDocument} from "@monaco-imposture-tools/core";
import {AzLogicAppNode, AzLogicAppNodeType, DataType} from "./base";

export class AzLogicAppNodeUtils{

  static findFunctionCallNodeFromNode(
    node?: AzLogicAppNodeType<
      | 'function-call-complete'
      | 'function-call'
      | 'function-call-target'
      | 'object-identifiers'
      | 'object-identifiers:wPunctuation'
      | 'object-identifiers-captures'
      | 'punctuation'
      | 'punctuation-capture'
      >
  ): AzLogicAppNodeType<'function-call'> | undefined {
    switch (node?.$impostureLang?.dataType) {
      case 'function-call-complete':
        if (node?.children?.length) {
          return this.findFunctionCallNodeFromNode(node.children[0] as AzLogicAppNodeType<'function-call'>);
        } else {
          return;
        }
      case 'function-call':
        return node as any;
      case 'function-call-target':
        return this.findFunctionCallNodeFromNode(node.parent as AzLogicAppNodeType<'function-call'>);
      case 'object-identifiers-captures':
      case 'punctuation-capture':
        return this.findFunctionCallNodeFromNode(
          node.parent as AzLogicAppNodeType<'object-identifiers' | 'object-identifiers:wPunctuation' | 'punctuation'>
        );
      case 'punctuation':
      case 'object-identifiers':
      case 'object-identifiers:wPunctuation':
        return this.findFunctionCallNodeFromNode(node.parent as AzLogicAppNodeType<'function-call'>);
    }
    return;
  }

  static findOneStepCaptureOwner(node: AzLogicAppNode){
    switch (node.$impostureLang?.dataType) {
      case 'object-identifiers-captures':
      case 'punctuation-capture':
      case 'identifiers-capture':
        return node.parent;
    }
    return node;
  }

  static getFunctionCallFullname(node: AzLogicAppNodeType<'function-call'>, codeDocument: CodeDocument) {
    return codeDocument.getNodeContent(node).replace(/[?]/gm, '');
  }

  static listCommaIndicesOfParenthesesChildren(children?: AzLogicAppNode[]){
    const result: number[] = [];
    children?.forEach((value, index) => {
      if (value.$impostureLang?.dataType === 'comma') {
        result.push(index);
      }
    });
    return result;
  }

  private constructor() {
  }
}

export type ReturnChainType =
  | UnknownReturnChainType
  | PrimitiveReturnChainType
  | ArrayLiteralReturnChainType
  | FunctionCallReturnChainType
  | IdentifierReturnChainType
  | IdentifierInBracketNotationReturnChainType;

export abstract class AbstractReturnChainType {

  static getNodeReturnType(node: AzLogicAppNode, codeDocument: CodeDocument):ReturnChainType{
    switch (node.$impostureLang?.dataType) {
      case 'number':
      case 'string':
      case 'boolean':
      case 'null':
        return new PrimitiveReturnChainType(
          node.$impostureLang?.dataType,
          node.$impostureLang?.dataType,
          node,
          codeDocument.getNodeContent(node)
        );
      case 'identifiers':
      case 'identifiers:wPunctuation':
      case 'object-identifiers':
      case 'object-identifiers:wPunctuation': {
        const content = codeDocument.getNodeContent(node).replace(/[?\.]/gm, '');
        return new IdentifierReturnChainType(
          node?.$impostureLang?.dataType,
          content,
          node,
          content
        );
      }
      case 'array-literal':
        return new ArrayLiteralReturnChainType(
          'Array[]',
          node
        );
      case 'function-call-complete': {
        if (node.children?.length && node.children[0].$impostureLang?.dataType === 'function-call') {
          const functionFullName = AzLogicAppNodeUtils.getFunctionCallFullname(node.children[0] as any, codeDocument);
          return new FunctionCallReturnChainType(
            `${functionFullName}()`,
            node,
            functionFullName
          );
        }
        break;
      }
    }
    const content = codeDocument.getNodeContent(node);
    return new UnknownReturnChainType(
      node.$impostureLang?.dataType || 'unknown',
      node.$impostureLang?.dataType || 'unknown',
      node,
      content
    );
  }

  static isBracketNotation(
    node: AzLogicAppNode,
    codeDocument: CodeDocument
  ): IdentifierInBracketNotationReturnChainType | undefined{
    if (
      node &&
      node.$impostureLang?.dataType === 'array-literal'
    ) {
      let firstChildAstNode: AzLogicAppNode|undefined = undefined;
      let label = '';
      let identifierName = '';
      let isPropertyLiteral = false;
      if (node.children?.length){
        firstChildAstNode = node.children[0] as AzLogicAppNode;
        switch (firstChildAstNode.$impostureLang?.dataType) {
          case 'string':
            identifierName = codeDocument.getNodeContent(firstChildAstNode).replace(/'/gm, '');
            label = identifierName;
            isPropertyLiteral = true;
            break;
          case 'number':
            identifierName = codeDocument.getNodeContent(firstChildAstNode);
            label = identifierName;
            isPropertyLiteral = true;
            break;
          default:
            label = codeDocument.getNodeContent(firstChildAstNode);
            break;

        }
      }
      // const propertyNameOffset = node.children[0].offset + 1;
      // const propertyNameLength = (node.children[0].length || 2) - 2;
      // const identifierName = codeDocument.text.substr(propertyNameOffset, propertyNameLength);
      return new IdentifierInBracketNotationReturnChainType(
        identifierName,
        node,
        identifierName,
        true,
        node as AzLogicAppNodeType<'array-literal'>,
        isPropertyLiteral,
        node.children?.length? node.children[0] as any : undefined,
      );
    }
    return;
  }

  static findCompleteIdentifiersChain(
    node: AzLogicAppNode,
    codeDocument: CodeDocument
  ):{
    head: AzLogicAppNode;
    tail: AzLogicAppNode;
    chain: ReturnChainType[];
  }{
    const chain: ReturnChainType[] = [];

    if (
      node.$impostureLang?.dataType === 'object-identifiers-captures' ||
      node.$impostureLang?.dataType === 'identifiers-capture'
    ) {
      node = AzLogicAppNodeUtils.findOneStepCaptureOwner(node) as any;
    }

    let head = node;
    const tail = node;

    let oneElderSibling: AzLogicAppNode | undefined = node;
    while (
      oneElderSibling?.$impostureLang?.dataType === 'object-identifiers:wPunctuation' ||
      oneElderSibling?.$impostureLang?.dataType === 'identifiers:wPunctuation' ||
      oneElderSibling?.$impostureLang?.dataType === 'array-literal'
      ) {
      head = oneElderSibling;
      if (oneElderSibling?.$impostureLang?.dataType === 'array-literal') {
        const isBracketNotationRes = AbstractReturnChainType.isBracketNotation(oneElderSibling, codeDocument);
        if (isBracketNotationRes) {
          chain.unshift(isBracketNotationRes);
          oneElderSibling = isBracketNotationRes.literalArrayNode.findAnElderSibling();
          continue;
        } else {
          break;
        }
      }
      chain.unshift(AbstractReturnChainType.getNodeReturnType(oneElderSibling, codeDocument));
      oneElderSibling = oneElderSibling.findAnElderSibling();
    }

    if (oneElderSibling) {
      const theUltimateReturnType = AbstractReturnChainType.getNodeReturnType(oneElderSibling, codeDocument);
      switch (theUltimateReturnType.type) {
        case 'identifiers':
        case 'object-identifiers':
        case 'array-literal':
        case 'number':
        case 'string':
        case 'boolean':
        case 'null':
        case 'function-call-complete':
          head = oneElderSibling;
          chain.unshift(theUltimateReturnType);
      }
    }

    return {
      head,
      tail,
      chain,
    };
  }

  static findCompleteForwardIdentifiersChain(
    node: AzLogicAppNode,
    codeDocument: CodeDocument,
    popupFromCapture = false
  ): {
    head: AzLogicAppNode;
    tail: AzLogicAppNode;
    chain: ReturnChainType[];
  } {
    let head = node;
    let tail = node;
    const chain: ReturnChainType[] = [];
    // popup from a capture token and use its owner as the leading token
    if (
      popupFromCapture &&
      (node.$impostureLang?.dataType === 'object-identifiers-captures' ||
        node.$impostureLang?.dataType === 'identifiers-capture')
    ) {
      node = AzLogicAppNodeUtils.findOneStepCaptureOwner(node) as any;
    }

    if (node) {
      const curReturnType = AbstractReturnChainType.getNodeReturnType(node, codeDocument);
      switch (curReturnType.type) {
        case 'identifiers':
        case 'object-identifiers':
        case 'array-literal':
        case 'number':
        case 'string':
        case 'boolean':
        case 'null':
        case 'function-call-complete':
          head = node;
          chain.push(curReturnType);
      }
    }

    let oneYoungerSibling: AzLogicAppNode | undefined = node.findAYoungerSibling();
    while (
      oneYoungerSibling?.$impostureLang?.dataType === 'object-identifiers:wPunctuation' ||
      oneYoungerSibling?.$impostureLang?.dataType === 'identifiers:wPunctuation' ||
      oneYoungerSibling?.$impostureLang?.dataType === 'array-literal'
      ) {
      tail = oneYoungerSibling;
      if (oneYoungerSibling?.$impostureLang?.dataType === 'array-literal') {
        // to check punctuation
        const isBracketNotationRes = AbstractReturnChainType.isBracketNotation(oneYoungerSibling, codeDocument);
        if (isBracketNotationRes) {
          chain.push(isBracketNotationRes);
          oneYoungerSibling = isBracketNotationRes.literalArrayNode.findAYoungerSibling();
          continue;
        } else {
          break;
        }
      }
      chain.push(AbstractReturnChainType.getNodeReturnType(oneYoungerSibling, codeDocument));
      oneYoungerSibling = oneYoungerSibling.findAYoungerSibling();
    }

    return {
      head,
      tail,
      chain,
    };
  }

  static interpretIdentifierChainList(idChain: ReturnChainType[]){
    return (idChain as (IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType)[]).map(
      (oneRetTyp) => ({path: oneRetTyp.identifierName, retChainTyp: oneRetTyp})
    )
  }

  protected constructor(
    public type: DataType | 'unknown',
    public label: string,
    public node: ASTNode,
  ) {
  }
}

export class UnknownReturnChainType extends AbstractReturnChainType{
  type: Exclude<
    AbstractReturnChainType['type'],
    | PrimitiveReturnChainType['type']
    | ArrayLiteralReturnChainType['type']
    | FunctionCallReturnChainType['type']
    | IdentifierReturnChainType['type']
    | IdentifierInBracketNotationReturnChainType['type']
    >
  constructor(
    type: Exclude<
      AbstractReturnChainType['type'],
      | PrimitiveReturnChainType['type']
      | ArrayLiteralReturnChainType['type']
      | FunctionCallReturnChainType['type']
      | IdentifierReturnChainType['type']
      | IdentifierInBracketNotationReturnChainType['type']
      >,
    label: string,
    node: ASTNode,
    public content:string,
  ) {
    super(type, label, node);
  }
}

export class PrimitiveReturnChainType extends AbstractReturnChainType{
  type: 'number' | 'string' | 'boolean' | 'null';
  constructor(
    type: 'number' | 'string' | 'boolean' | 'null',
    label: string, node: ASTNode,
    public readonly constantValueString: string
  ) {
    super(type, label, node);
  }
}

export class ArrayLiteralReturnChainType extends AbstractReturnChainType{
  type: 'array-literal';
  constructor(
    label: string, node: ASTNode
  ) {
    super('array-literal', label, node);
  }
}

export class FunctionCallReturnChainType extends AbstractReturnChainType{
  type: 'function-call-complete';
  constructor(
    label: string, node: ASTNode,
    public functionFullName: string
  ) {
    super('function-call-complete', label, node);
  }
}

export class IdentifierReturnChainType extends AbstractReturnChainType{
  type: 'identifiers' | 'identifiers:wPunctuation' | 'object-identifiers' | 'object-identifiers:wPunctuation';
  constructor(
    type: 'identifiers' | 'identifiers:wPunctuation' | 'object-identifiers' | 'object-identifiers:wPunctuation',
    label: string, node: ASTNode,
    public identifierName: string
  ) {
    super(type, label, node);
  }
}

export class IdentifierInBracketNotationReturnChainType extends AbstractReturnChainType{
  type: 'array-literal';
  constructor(
    label: string, node: ASTNode,
    public identifierName: string,
    public isBracketNotation: true,
    public literalArrayNode: AzLogicAppNodeType<'array-literal'>,
    public isPropertyLiteral: boolean,
    public propertyNameNode?: AzLogicAppNode
  ) {
    super('array-literal', label, node);
  }
}

export class ParenthesesElderSiblingType {

  static UNKNOWN = 0xa00;
  static NOT_FOUND = 0xa01;
  static FUNCTION_CALL = 0xa02;
  static BENEATH_A_PAIR_OF_PARENTHESES = 0xa03;

  static checkParenthesesElderSibling(node: AzLogicAppNode):ParenthesesElderSiblingType{
    if (node.$impostureLang?.dataType === 'parentheses') {
      const theElderSibling = node.findAnElderSibling();
      if (theElderSibling?.$impostureLang?.dataType === 'function-call') {
        return ParenthesesElderSiblingType.FUNCTION_CALL;
      }
      return ParenthesesElderSiblingType.BENEATH_A_PAIR_OF_PARENTHESES;
    }
    return ParenthesesElderSiblingType.NOT_FOUND;
  }

  static amongFunctionCall(node: AzLogicAppNode | undefined){
    if (node) {
      const visited: AzLogicAppNode[] = [];
      let parenthesesCheckResult: ParenthesesElderSiblingType = ParenthesesElderSiblingType.NOT_FOUND;
      let found = false;

      let head = node;
      let directChild: AzLogicAppNode | undefined = undefined;
      while (head && !found) {
        visited.unshift(head as AzLogicAppNode);
        const chkRes = this.checkParenthesesElderSibling(head);
        if (
          chkRes === ParenthesesElderSiblingType.FUNCTION_CALL ||
          chkRes === ParenthesesElderSiblingType.BENEATH_A_PAIR_OF_PARENTHESES
        ) {
          parenthesesCheckResult = chkRes;
          found = true;
          break;
        }
        directChild = head;
        head = head.parent as AzLogicAppNode;
      }

      return {
        parenthesesCheckResult,
        head,
        directChild,
        tail: node,
      };
    }
    return;
  }

  private constructor() {
  }
}
