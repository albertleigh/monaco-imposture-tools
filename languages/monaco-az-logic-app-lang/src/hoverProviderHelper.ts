import {ASTNode, CodeDocument} from "@monaco-imposture-tools/core";
import {languages} from './editor.api';
import {
  AzLogicAppNode,
  DescriptionType,
  IdentifierInBracketNotationReturnChainType,
  IdentifierReturnChainType, IdentifierType,
  IdentifierTypeName
} from './base';
import {
  determineOverloadFunParamSeq,
  findAnElderSibling, findAYoungerSibling,
  findCompleteIdentifiersChain,
  findFunctionCallNodeFromNode,
  getFunctionCallFullname
} from './utils';
import {findAmongGlobalDescription} from "./values";

export function generateHover(_node:ASTNode|undefined, codeDocuments: CodeDocument):languages.Hover | undefined{
  let node = _node as AzLogicAppNode;

  if (node?.$impostureLang){

    if (node.$impostureLang.dataType === 'atSymbol'){
      const youngerNode = findAYoungerSibling(node);
      if (
        youngerNode &&
        youngerNode.$impostureLang?.dataType !== 'atSymbol'
      ){
        node = youngerNode;
      }
    }

    if (node.$impostureLang?.dataType === 'comma') {
      node = findAnElderSibling(node) || node;
    }

    if(node.$impostureLang?.dataType === 'parentheses'){
      node = findAnElderSibling(node) || node;
    }

    // function call target and its identifiers
    switch (node.$impostureLang?.dataType) {
      case "function-call-complete":
      case "function-call":
      case 'function-call-target':
      case 'object-identifiers-captures':
      case 'punctuation-capture':
      case 'punctuation':
      case 'object-identifiers':
      case 'object-identifiers:wPunctuation':
      {
        const functionCallNode = findFunctionCallNodeFromNode(node as any);
        if (functionCallNode){
          const functionCallFullName = getFunctionCallFullname(functionCallNode, codeDocuments);
          const functionCallPaths = functionCallFullName.split('.');
          const theDesc = findAmongGlobalDescription(functionCallPaths);
          if (
            theDesc &&
            (
              theDesc._$type === DescriptionType.FunctionValue ||
              theDesc._$type === DescriptionType.OverloadedFunctionValue
            ) &&
            theDesc._$desc?.length
          ){
            return {
              contents: theDesc._$desc.map(value => ({value, isTrusted: true}))
            }
          }
          return {
            contents: [{ value: `Unrecognized function: \`${getFunctionCallFullname(functionCallNode, codeDocuments)}\``, isTrusted: true}],
          }
        }
        break;
      }
    }

    // return val of one complete function call
    switch (node.$impostureLang?.dataType) {
      case 'object-identifiers-captures':
      case 'identifiers-capture':
      case 'object-identifiers':
      case 'object-identifiers:wPunctuation':
      case 'identifiers':
      case 'identifiers:wPunctuation':
      {
        const identifierChainRes = findCompleteIdentifiersChain(node, codeDocuments);
        if (identifierChainRes.chain.length){
          if (identifierChainRes.chain[0].type === 'function-call-complete'){
            // alright, we gonna infer from function call return type
            const functionFullName = identifierChainRes.chain[0].functionFullName;
            const theFunDesc = findAmongGlobalDescription(functionFullName.split('.'));
            if (theFunDesc){
              let retTyp:IdentifierType | undefined = undefined;
              if (theFunDesc._$type === DescriptionType.FunctionValue){
                retTyp = theFunDesc._$returnType;
              }else if (theFunDesc._$type === DescriptionType.OverloadedFunctionValue){
                const paraSeq = determineOverloadFunParamSeq(codeDocuments, identifierChainRes.chain[0].node as any, theFunDesc);
                if (paraSeq < theFunDesc._$returnType.length){
                  retTyp = theFunDesc._$returnType[paraSeq];
                }
              }
              if (
                retTyp &&
                retTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE &&
                retTyp.returnTypeChainList?.length
              ){
                const theReturnValueDesc = findAmongGlobalDescription([
                  ...retTyp.returnTypeChainList,
                  ...(identifierChainRes.chain.slice(1) as (IdentifierInBracketNotationReturnChainType|IdentifierReturnChainType)[])
                    .map(value => value.identifierName)
                ]);
                if (
                  theReturnValueDesc && theReturnValueDesc._$type &&
                  theReturnValueDesc._$desc.length
                ){
                  return {
                    contents: theReturnValueDesc._$desc.map(value => ({value, isTrusted: true}))
                  }
                }
              }
            }
          }else if (
            'identifierName' in identifierChainRes.chain[0] &&
            identifierChainRes.chain[0].identifierName
          ){
            // all have identifier names
            const packagePaths  =
              (identifierChainRes.chain as (IdentifierInBracketNotationReturnChainType|IdentifierReturnChainType)[])
                .map(value => value.identifierName);
            const theDesc = findAmongGlobalDescription(packagePaths);
            if (
              theDesc && theDesc._$type &&
              theDesc._$desc.length
            ){
              return {
                contents: theDesc._$desc.map(value => ({value, isTrusted: true}))
              }
            }
          }

          return {
            contents: [{ value: `Unrecognized identifier: ${identifierChainRes.chain.map(value => value.label).join('.')}` , isTrusted:true }],
          }
        }
        break;
      }
    }

    if (node.$impostureLang?.dataType === 'atSymbol'){
      return {
        contents: [{
          value: `Escape at symbol for Azure logic app expression`, isTrusted: true
        }]
      }
    }

    if (node.$impostureLang?.dataType){
      return {
        contents: [{ value:  `${node.$impostureLang?.dataType}`, isTrusted: true}],
      }
    }

    return  {
      contents: [{ value: `Unrecognized ${node.$impostureLang?.namespaces.join(',')}`, isTrusted: true}],
    };
  }

  return undefined;
}
