import type {languages} from 'monaco-editor';
import {
  DescriptionType, ReferenceValueDescription,
} from './values';
import {
  AzLgcLangSyntaxNodeContext,
  SyntaxNode,
  AzLgcExpDocument,
  AtSymbolNode,
  CommaPunctuator,
  ParenthesisNode,
  FunctionCallNode,
  FunctionCallTarget,
  IdentifierNode,
  EscapedAtSymbolNode,
  RootFunctionCallNode,
  AccessorPunctuator,
  IdentifierNodeWithPunctuation,
  IdentifierNodeInBracketNotation
} from './parser';

export function generateHover(node: SyntaxNode<AzLgcLangSyntaxNodeContext> | undefined, _azLgcExpDocument: AzLgcExpDocument): languages.Hover | undefined {

  if (node) {

    if (
      node.syntaxNodeContext.beneathIncompleteRootFunctionCall
    ){
      // show no hover message for any nodes beneath an incomplete root function call
      return {
        contents: [],
      };
    }


    if (node instanceof RootFunctionCallNode){
      // innerFunctionCallNode might be undefined
      if (node.innerFunctionCallNode){
        node = node.innerFunctionCallNode;
      }else{
        node = node.atSymbolNode;
      }
    }

    if (node instanceof AtSymbolNode){
      if (node.youngerSibling &&  !(node.youngerSibling instanceof AtSymbolNode)){
        node = node.youngerSibling;
      }
    }

    if (
      node instanceof CommaPunctuator ||
      node instanceof ParenthesisNode
    ){
      node = node.elderSibling || node;
    }

    if(
      node instanceof AccessorPunctuator &&
      node.parent
    ){
      node = node.parent;
    }

    // function call target and its identifiers
    let funCallTarget:FunctionCallTarget | undefined;
    if (
      node.parent instanceof FunctionCallNode &&
      Array.from(node.siblings).some(one => {
        if (one instanceof FunctionCallTarget){
          funCallTarget = one;
          return true;
        }
        return false;
      })
    ){
      const funCall = node.parent;
      const funVd = funCallTarget?.target;
      // const funVd = funCall.functionValueDescription;
      if (
        funCallTarget &&
        funVd &&
        (funVd._$type === DescriptionType.FunctionValue ||
          funVd._$type === DescriptionType.OverloadedFunctionValue) &&
        funVd._$desc?.length
      ){
        return {
          contents: funVd._$desc.map((value) => ({value, isTrusted: true})),
        };
      }else{
        return {
          contents: [
            {
              value: `Unrecognized function: \`${funCall.functionFullName}\``,
              isTrusted: true,
            },
          ],
        };
      }

    }

    if (
      (
        node instanceof IdentifierNodeWithPunctuation ||
        node instanceof IdentifierNodeInBracketNotation
      ) &&
      node.target instanceof ReferenceValueDescription &&
      node.target._$valueType.isAnyObject
    ){
      return {
        contents: [{value: `${node.identifierName}:${node.target._$valueType.label}`}]
      }
    }

    if (node instanceof IdentifierNode){
      const theDesc = node.target;
      if (theDesc && theDesc._$type && theDesc._$desc.length) {
        return {
          contents: theDesc._$desc.map((value) => ({value, isTrusted: true})),
        };
      }
    }

    // function call
    if (node instanceof FunctionCallNode){
      const funCall = node;
      const funVd = funCall.functionValueDescription;
      // const funVd = funCall.functionValueDescription;
      if (
        funVd &&
        (funVd._$type === DescriptionType.FunctionValue ||
          funVd._$type === DescriptionType.OverloadedFunctionValue) &&
        funVd._$desc?.length
      ) {
        return {
          contents: funVd._$desc.map((value) => ({value, isTrusted: true})),
        };
      }else{
        return {
          contents: [
            {
              value: `Unrecognized function: \`${funCall.functionFullName}\``,
              isTrusted: true,
            },
          ],
        };
      }
    }

    if (node instanceof AtSymbolNode){
      return {
        contents: [
          {
            value: `At symbol for Azure logic app expression`,
            isTrusted: true,
          },
        ],
      };
    }

    if (node instanceof EscapedAtSymbolNode){
      return {
        contents: [
          {
            value: `Escape at symbol for Azure logic app expression`,
            isTrusted: true,
          },
        ],
      };
    }

    if (node.astNode.$impostureLang?.dataType) {
      // return {
      //   contents: [{value: `${node.astNode.$impostureLang?.dataType}`, isTrusted: true}],
      // };
      // emmm better not print any hover message for any un-handled defined ast node
      return {contents:[]};
    }

    return {
      contents: [{value: `Unrecognized ${node.astNode.$impostureLang?.namespaces.join(',')}`, isTrusted: true}],
    };
  }

  return undefined;
}
