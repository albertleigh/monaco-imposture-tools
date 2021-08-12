import {
  AzLogicAppNode,
  AzLogicAppNodeType,
  DescriptionType,
  IdentifierInBracketNotationReturnChainType,
  IdentifierReturnChainType,
  IdentifierType,
  IdentifierTypeName,
  ParenthesesElderSiblingType,
  ReturnChainType,
  ValueDescription
} from './base';
import {findAmongGlobalDescription} from "./values";
import {CodeDocument} from "@monaco-imposture-tools/core";

export function findFunctionCallNodeFromNode(
  node?:AzLogicAppNodeType<
    'function-call-complete' |
    'function-call' |
    'function-call-target' |
    'object-identifiers' |
    'object-identifiers:wPunctuation' |
    'object-identifiers-captures' |
    'punctuation' |
    'punctuation-capture'>
):AzLogicAppNodeType<'function-call'>| undefined{
  switch (node?.$impostureLang?.dataType) {
    case "function-call-complete":
      if (node?.children?.length){
        return findFunctionCallNodeFromNode(node.children[0] as AzLogicAppNodeType<'function-call'>);        
      }else{
        return ;
      }
    case "function-call":
      return node as any;
    case 'function-call-target':
      return findFunctionCallNodeFromNode(node.parent as AzLogicAppNodeType<'function-call'>);
    case 'object-identifiers-captures':
    case 'punctuation-capture':
      return findFunctionCallNodeFromNode(node.parent as AzLogicAppNodeType<'object-identifiers'| 'object-identifiers:wPunctuation' | 'punctuation'>);
    case 'punctuation':
    case 'object-identifiers':
    case 'object-identifiers:wPunctuation':
      return findFunctionCallNodeFromNode(node.parent as AzLogicAppNodeType<'function-call'>);
  }
  return;
}

export function getFunctionCallFullname(node:AzLogicAppNodeType<'function-call'>, codeDocument:CodeDocument){
  return codeDocument.getNodeContent(node).replace(/[?]/, '');
}

export function findAnElderSibling(node:AzLogicAppNode){
  if (node.parent){
    let theIndex = node.parent.children?.findIndex(value => (value === node));
    if (typeof theIndex === 'number' && theIndex >0){
      return node.parent.children![theIndex-1] as AzLogicAppNode;
    }
  }
  return
}

export function findAYoungerSibling(node:AzLogicAppNode){
  if (node.parent){
    let theIndex = node.parent.children?.findIndex(value => (value === node));
    if (typeof theIndex === 'number' && theIndex < node.parent.children!.length -1){
      return node.parent.children![theIndex+1] as AzLogicAppNode;
    }
  }
  return
}

export function getNodeReturnType(node:AzLogicAppNode, codeDocument:CodeDocument):ReturnChainType{
  switch (node.$impostureLang?.dataType) {
    case "number":
    case "string":
    case "boolean":
    case "null":
      return {
        type: node.$impostureLang?.dataType,
        label: node.$impostureLang?.dataType,
        node,
      };
    case "identifiers":
    case "identifiers:wPunctuation":
    case "object-identifiers":
    case "object-identifiers:wPunctuation":
      const content = codeDocument.getNodeContent(node).replace(/[?\.]/, '');
      return {
        type: node?.$impostureLang?.dataType,
        label:content,
        identifierName: content,
        node: node
      };
    case "array-literal":
      return {
        type: "array-literal",
        label: "Array[]",
        node,
      }
    case "function-call-complete":
    {
      if (node.children?.length  && node.children[0].$impostureLang?.dataType === "function-call"){
        const functionFullName = getFunctionCallFullname(node.children[0] as any, codeDocument);
        return {
          type: 'function-call-complete',
          label: `${functionFullName}()`,
          node,
          functionFullName,
          // todo try to determine the index of overloaded para
        };
      }
      break;
    }
  }
  const content = codeDocument.getNodeContent(node);
  return {
    type: node.$impostureLang?.dataType || 'unknown',
    label: node.$impostureLang?.dataType || 'unknown',
    content,
    node,
  } as any;
}

export function findOneStepCaptureOwner(node:AzLogicAppNode){
  switch (node.$impostureLang?.dataType) {
    case 'object-identifiers-captures':
    case 'punctuation-capture':
    case 'identifiers-capture':
      return node.parent;
  }
  return node;
}

export function isBracketNotation(node:AzLogicAppNode, codeDocument:CodeDocument):IdentifierInBracketNotationReturnChainType|undefined{
  if (
    node &&
    node.$impostureLang?.dataType === 'array-literal' &&
    node.children?.length === 1 &&
    node.children[0].$impostureLang?.dataType === 'string'
  ){
    const theElderSibling = findAnElderSibling(node);
    const propertyNameOffset = node.children[0].offset+1;
    const propertyNameLength = (node.children[0].length || 2) -2;
    const identifierName = codeDocument.text.substr(propertyNameOffset, propertyNameLength)
    if (
      theElderSibling && theElderSibling.$impostureLang?.dataType=== 'punctuation'
    ){
      return {
        type: 'array-literal',
        isBracketNotation: true,
        label: identifierName,
        identifierName,
        punctuationNode: theElderSibling as any,
        node: node,
        propertyNameNode: node.children[0] as any,
        propertyNameOffset,
        propertyNameLength,
      }
    }
  }
  return ;
}

export function isForwardBracketNotation(node:AzLogicAppNode, codeDocument:CodeDocument):IdentifierInBracketNotationReturnChainType|undefined{
  if (
    node &&
    node.$impostureLang?.dataType === 'punctuation'
  ){
    const theYoungerSibling = findAYoungerSibling(node);
    if (
      theYoungerSibling &&
      theYoungerSibling.$impostureLang?.dataType === 'array-literal' &&
      theYoungerSibling.children?.length === 1 &&
      theYoungerSibling.children[0].$impostureLang?.dataType === 'string'
    ){
      const propertyNameOffset = theYoungerSibling.children[0].offset+1;
      const propertyNameLength = (theYoungerSibling.children[0].length || 2) -2;
      const identifierName = codeDocument.text.substr(propertyNameOffset, propertyNameLength)
      return {
        type: 'array-literal',
        isBracketNotation: true,
        label: identifierName,
        identifierName,
        punctuationNode: node as any,
        node: theYoungerSibling,
        propertyNameNode: theYoungerSibling.children[0] as any,
        propertyNameOffset,
        propertyNameLength,
      }
    }
  }
  return
}

export function findCompleteIdentifiersChain(node:AzLogicAppNode, codeDocument:CodeDocument):{
  head: AzLogicAppNode,
  tail: AzLogicAppNode,
  chain:ReturnChainType[]
}{
  let chain:ReturnChainType[] = [];

  if (
    node.$impostureLang?.dataType === 'object-identifiers-captures' ||
    node.$impostureLang?.dataType === 'identifiers-capture'
  ){
    node = findOneStepCaptureOwner(node) as any;
  }

  let head = node;
  const tail = node;

  let oneElderSibling: AzLogicAppNode | undefined = node;
  while (
    oneElderSibling?.$impostureLang?.dataType === 'object-identifiers:wPunctuation' ||
    oneElderSibling?.$impostureLang?.dataType === 'identifiers:wPunctuation' ||
    oneElderSibling?.$impostureLang?.dataType === 'array-literal'
    ){
    head = oneElderSibling;
    if (oneElderSibling?.$impostureLang?.dataType === 'array-literal'){
      const isBracketNotationRes = isBracketNotation(oneElderSibling, codeDocument)
      if (isBracketNotationRes){
        chain.unshift(isBracketNotationRes);
        oneElderSibling = findAnElderSibling(isBracketNotationRes.punctuationNode);
        continue;
      }else {
        break;
      }
    }
    chain.unshift(getNodeReturnType(oneElderSibling, codeDocument));
    oneElderSibling = findAnElderSibling(oneElderSibling);
  }

  if (oneElderSibling){
    const theUltimateReturnType = getNodeReturnType(oneElderSibling, codeDocument);
    switch (theUltimateReturnType.type){
      case "identifiers":
      case "object-identifiers":
      case "array-literal":
      case "number":
      case "string":
      case "boolean":
      case "null":
      case "function-call-complete":
        head = oneElderSibling;
        chain.unshift(theUltimateReturnType);
    }
  }

  return {
    head, tail, chain
  };
}

export function findCompleteForwardIdentifiersChain(node:AzLogicAppNode, codeDocument:CodeDocument, popupFromCapture:boolean = false):{
  head: AzLogicAppNode,
  tail: AzLogicAppNode,
  chain:ReturnChainType[]
}{
  let head = node;
  let tail = node;
  let chain:ReturnChainType[] = [];

  if (
    popupFromCapture &&
    (
      node.$impostureLang?.dataType === 'object-identifiers-captures' ||
      node.$impostureLang?.dataType === 'identifiers-capture'
    )
  ){
    node = findOneStepCaptureOwner(node) as any;
  }

  if (node){
    const curReturnType = getNodeReturnType(node, codeDocument);
    switch (curReturnType.type){
      case "identifiers":
      case "object-identifiers":
      case "array-literal":
      case "number":
      case "string":
      case "boolean":
      case "null":
      case "function-call-complete":
        head = node;
        chain.push(curReturnType);
    }
  }

  let oneYoungerSibling: AzLogicAppNode | undefined = findAYoungerSibling(node);
  while (
    oneYoungerSibling?.$impostureLang?.dataType === 'object-identifiers:wPunctuation' ||
    oneYoungerSibling?.$impostureLang?.dataType === 'identifiers:wPunctuation' ||
    oneYoungerSibling?.$impostureLang?.dataType === 'punctuation'
    ){
    tail = oneYoungerSibling;
    if (oneYoungerSibling?.$impostureLang?.dataType === 'punctuation'){
      // to check punctuation
      const isBracketNotationRes = isForwardBracketNotation(oneYoungerSibling, codeDocument)
      if (isBracketNotationRes){
        chain.push(isBracketNotationRes);
        oneYoungerSibling = findAYoungerSibling(isBracketNotationRes.punctuationNode);
        continue;
      }else {
        break;
      }
    }
    chain.push(getNodeReturnType(oneYoungerSibling, codeDocument));
    oneYoungerSibling = findAYoungerSibling(oneYoungerSibling);
  }

  return {
    head, tail, chain
  };

}



export function checkParenthesesElderSibling(node:AzLogicAppNode):ParenthesesElderSiblingType{
  if (node.$impostureLang?.dataType === 'parentheses'){
    const theElderSibling = findAnElderSibling(node);
    if (theElderSibling?.$impostureLang?.dataType === 'function-call'){
      return ParenthesesElderSiblingType.FUNCTION_CALL;
    }
    return ParenthesesElderSiblingType.BENEATH_A_PAIR_OF_PARENTHESES;
  }
  return ParenthesesElderSiblingType.NOT_FOUND;
}

export function amongFunctionCall(node:AzLogicAppNode|undefined){

  if (node){
    const visited:AzLogicAppNode[] = [];
    let parenthesesCheckResult:ParenthesesElderSiblingType = ParenthesesElderSiblingType.NOT_FOUND;
    let found = false;

    let head = node;
    let directChild:AzLogicAppNode|undefined = undefined;
    while (head && !found){

      visited.unshift(head as AzLogicAppNode);
      const chkRes = checkParenthesesElderSibling(head);
      if (
        chkRes === ParenthesesElderSiblingType.FUNCTION_CALL ||
        chkRes === ParenthesesElderSiblingType.BENEATH_A_PAIR_OF_PARENTHESES
      ){
        parenthesesCheckResult = chkRes;
        found = true
        break;
      }
      directChild = head;
      head = head.parent as AzLogicAppNode;
    }

    return {
      parenthesesCheckResult,
      head,
      directChild,
      tail:node
    }
  }
  return
}

export function determinePreOffsetOfOneCommaBeneathParentheses(
  parentParentheses: AzLogicAppNodeType<'parentheses'>,
  comma:AzLogicAppNodeType<'comma'> | undefined
){
  let result = parentParentheses.offset + (parentParentheses.length || 2) -1;
  if (parentParentheses.children?.length){
    const lastChild = parentParentheses.children[parentParentheses.children?.length-1];
    const newOffset = lastChild.offset + (lastChild.length || 0);
    if (newOffset < result){
      result =newOffset;
    }
  }
  if (!comma){
    return result;
  }
  if (
    comma.parent === parentParentheses &&
    parentParentheses.children?.length
  ){
    const curCommaIndex  = comma.parent?.children?.indexOf(comma);
    if (typeof curCommaIndex === 'number' && curCommaIndex > 0){
      const theChild = parentParentheses.children[curCommaIndex -1];
      const newOffset = theChild.offset + (theChild.length || 0);
      if (newOffset < result){
        result =newOffset;
      }
    }
  }
  return result;
}

export function determinePostOffsetOfOneCommaBeneathParentheses(
  parentParentheses: AzLogicAppNodeType<'parentheses'>,
  comma:AzLogicAppNodeType<'comma'> | undefined
){
  let result = parentParentheses.offset+1;
  if (parentParentheses.children?.length){
    const firstChild = parentParentheses.children[0];
    const newOffset = firstChild.offset;
    if (newOffset > result){
      result =newOffset;
    }
  }
  if (!comma){
    return result;
  }
  if (
    comma.parent === parentParentheses &&
    parentParentheses.children?.length
  ){
    const curCommaIndex  = comma.parent?.children?.indexOf(comma);
    if (typeof curCommaIndex === 'number' && curCommaIndex +1 < parentParentheses.children.length){
      const theChild = parentParentheses.children[curCommaIndex + 1];
      const newOffset = theChild.offset;
      if (newOffset > result){
        result =newOffset;
      }
    }
  }
  return result;
}

export function listCommaIndicesOfParenthesesChildren(children?:AzLogicAppNode[]){
  const result:number[] = [];
  children?.forEach((value, index) => {
    if (value.$impostureLang?.dataType === 'comma'){
      result.push(index);
    }
  });
  return result;
}

export function inferIdentifierTypeFromChain(codeDocument:CodeDocument, idChain:ReturnChainType[]):IdentifierType | undefined{
  if (idChain.length === 0) return;
  if (idChain[0].type === 'function-call-complete'){
    const functionFullName = idChain[0].functionFullName;
    const theFunDesc = findAmongGlobalDescription(functionFullName.split('.'));

    if (theFunDesc){
      let retIdTyp: IdentifierType|undefined = determineReturnIdentifierTypeOfFunction(
        codeDocument,
        idChain[0].node as any,
        theFunDesc
      );

      if (retIdTyp){
        if (
          retIdTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE &&
          retIdTyp.returnTypeChainList?.length
        ){
          const theReturnValueDesc = findAmongGlobalDescription([
            ...retIdTyp.returnTypeChainList,
            ...(idChain.slice(1) as (IdentifierInBracketNotationReturnChainType|IdentifierReturnChainType)[])
              .map(value => value.identifierName)
          ]);
          if (
            theReturnValueDesc && theReturnValueDesc._$type === DescriptionType.ReferenceValue
          ){
            return theReturnValueDesc._$valueType
          }
        }else if (!retIdTyp.isComposite){
          return retIdTyp;
        }
      }
    }

  }else if (
    'identifierName' in idChain[0] &&
    idChain[0].identifierName
  ){
    const packagePaths  =
      (idChain as (IdentifierInBracketNotationReturnChainType|IdentifierReturnChainType)[])
        .map(value => value.identifierName);
    const theRefDesc = findAmongGlobalDescription(packagePaths);
    if (theRefDesc?._$type === DescriptionType.ReferenceValue){
      if (
        theRefDesc._$valueType.type === IdentifierTypeName.OBJECT
      ){
        // todo: ooops, currently we cannot support non-primitive identifier type
        // will be fixed once we switched from enum id type to class based identifier type
      }else if (!theRefDesc._$valueType.isComposite){
        return theRefDesc._$valueType;
      }
    }
  }
  switch (idChain[0].type) {
    case "number":
      return IdentifierType.Number
    case "string":
      return IdentifierType.String
    case "boolean":
      return IdentifierType.Boolean
    case "null":
      return IdentifierType.Null;
    case "array-literal":
      return IdentifierType.Array;
  }
  return ;
}

export function populateVarParaIncreasingly(arr:IdentifierType[], varArgIndex:number){
  if (
    varArgIndex < arr.length &&
    arr[varArgIndex].isVarList
  ){
    arr.splice(varArgIndex, 0, arr[varArgIndex])
  }
}

export function determineOverloadFunParamSeq(codeDocument:CodeDocument, funNode:AzLogicAppNode, funVd:ValueDescription):number {
  if (
    funNode.$impostureLang?.dataType === 'function-call-complete' &&
    funNode.children?.length  &&
    funNode.children[0].$impostureLang?.dataType === "function-call" &&
    funNode.children[1].$impostureLang?.dataType === "parentheses" &&
    funVd._$type === DescriptionType.OverloadedFunctionValue
  ){
    const parenthesesNode = funNode.children[1];
    // ensure we duplicate another array of the para list
    let curParaCandidates = funVd._$parameterTypes // paraTypes appended w/ an index
      .map((value, index) => [ ...value, (index as unknown) as IdentifierType]);
    let commaIndices = listCommaIndicesOfParenthesesChildren(parenthesesNode.children as AzLogicAppNode[]|undefined);
    // check para size
    const sizeMatchingParaCandidates = curParaCandidates.filter(value => value.length -1 === commaIndices.length +1)

    // noop there would be var list args
    // no if (!curParaCandidates.length) return 0;
    if (sizeMatchingParaCandidates.length === 1) return (sizeMatchingParaCandidates[0][sizeMatchingParaCandidates[0].length-1]) as unknown as number

    if (
      parenthesesNode.children?.length
    ){
      // check para type one by one
      commaIndices.unshift(0);
      commaIndices.push(parenthesesNode.children.length-1);
      // iterate, seize and validate param return type
      let paraIndex =0;
      while (paraIndex < commaIndices.length-1){
        const oneParaNode =
          paraIndex === 0 ?
            parenthesesNode.children[commaIndices[paraIndex]]:
            findAYoungerSibling(parenthesesNode.children[commaIndices[paraIndex]] as any);
        if (oneParaNode){
          const oneIdChain = findCompleteForwardIdentifiersChain(oneParaNode as any, codeDocument);
          const sourceIdTyp = inferIdentifierTypeFromChain(codeDocument, oneIdChain.chain);
          curParaCandidates = curParaCandidates.filter(value => {
            if (paraIndex < value.length - 1){
              if (value[paraIndex].isVarList){
                populateVarParaIncreasingly(value, paraIndex)
              }
              return sourceIdTyp?.assignableTo(value[paraIndex]);
            }
            return false;
          })
        }else{
          // unexpected tokens found
          break;
        }
        if (!curParaCandidates.length) return 0;
        if (curParaCandidates.length === 1) return (curParaCandidates[0][curParaCandidates[0].length-1]) as unknown as number
      }
    }
  }
  // return the first para if no candidate found
  return 0;
}

export function determineReturnIdentifierTypeOfFunction(
  codeDocument:CodeDocument,
  funNode:AzLogicAppNode,
  functionValueDescription: ValueDescription,
):IdentifierType | undefined{
  let retTyp: IdentifierType | undefined = undefined;
  if (functionValueDescription._$type === DescriptionType.FunctionValue){
    // regular function
    retTyp = functionValueDescription._$returnType;
  }else if (functionValueDescription._$type === DescriptionType.OverloadedFunctionValue){
    // overloaded function
    const paramIndex = determineOverloadFunParamSeq(codeDocument, funNode, functionValueDescription);
    if (paramIndex < functionValueDescription._$returnType.length){
      retTyp = functionValueDescription._$returnType[paramIndex];
    }
  }
  return retTyp;
}
