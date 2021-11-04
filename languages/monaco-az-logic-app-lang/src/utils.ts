import {CodeDocument} from '@monaco-imposture-tools/core';
import {
  AzLogicAppLangConstants,
  AzLogicAppNode,
  AzLogicAppNodeType, createPkgValDesc, createRefValDesc, DescCollItem,
  DescriptionType, DescriptorCollection, EmptyParaRetDescCollItem,
  IdentifierInBracketNotationReturnChainType,
  IdentifierReturnChainType,
  IdentifierType,
  IdentifierTypeName, OlFunDescCollItem, PackageDescription,
  ParenthesesElderSiblingType,
  ReturnChainType, SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME, SymbolTable,
  ValueDescription, ValueDescriptionDictionary, ValueDescriptionDictionaryFunctionKey,
} from './base';

//#region lexical utils

export function findFunctionCallNodeFromNode(
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
        return findFunctionCallNodeFromNode(node.children[0] as AzLogicAppNodeType<'function-call'>);
      } else {
        return;
      }
    case 'function-call':
      return node as any;
    case 'function-call-target':
      return findFunctionCallNodeFromNode(node.parent as AzLogicAppNodeType<'function-call'>);
    case 'object-identifiers-captures':
    case 'punctuation-capture':
      return findFunctionCallNodeFromNode(
        node.parent as AzLogicAppNodeType<'object-identifiers' | 'object-identifiers:wPunctuation' | 'punctuation'>
      );
    case 'punctuation':
    case 'object-identifiers':
    case 'object-identifiers:wPunctuation':
      return findFunctionCallNodeFromNode(node.parent as AzLogicAppNodeType<'function-call'>);
  }
  return;
}

export function getFunctionCallFullname(node: AzLogicAppNodeType<'function-call'>, codeDocument: CodeDocument) {
  return codeDocument.getNodeContent(node).replace(/[?]/, '');
}

export function findAnElderSibling(node: AzLogicAppNode) {
  if (node.parent) {
    const theIndex = node.parent.children?.findIndex((value) => value === node);
    if (typeof theIndex === 'number' && theIndex > 0) {
      return node.parent.children![theIndex - 1] as AzLogicAppNode;
    }
  }
  return;
}

export function findAYoungerSibling(node: AzLogicAppNode) {
  if (node.parent) {
    const theIndex = node.parent.children?.findIndex((value) => value === node);
    if (typeof theIndex === 'number' && theIndex < node.parent.children!.length - 1) {
      return node.parent.children![theIndex + 1] as AzLogicAppNode;
    }
  }
  return;
}

export function getNodeReturnType(node: AzLogicAppNode, codeDocument: CodeDocument): ReturnChainType {
  switch (node.$impostureLang?.dataType) {
    case 'number':
    case 'string':
    case 'boolean':
    case 'null':
      return {
        type: node.$impostureLang?.dataType,
        label: node.$impostureLang?.dataType,
        node,
      };
    case 'identifiers':
    case 'identifiers:wPunctuation':
    case 'object-identifiers':
    case 'object-identifiers:wPunctuation': {
      const content = codeDocument.getNodeContent(node).replace(/[?\.]/, '');
      return {
        type: node?.$impostureLang?.dataType,
        label: content,
        identifierName: content,
        node: node,
      };
    }
    case 'array-literal':
      return {
        type: 'array-literal',
        label: 'Array[]',
        node,
      };
    case 'function-call-complete': {
      if (node.children?.length && node.children[0].$impostureLang?.dataType === 'function-call') {
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

export function findOneStepCaptureOwner(node: AzLogicAppNode) {
  switch (node.$impostureLang?.dataType) {
    case 'object-identifiers-captures':
    case 'punctuation-capture':
    case 'identifiers-capture':
      return node.parent;
  }
  return node;
}

export function isBracketNotation(
  node: AzLogicAppNode,
  codeDocument: CodeDocument
): IdentifierInBracketNotationReturnChainType | undefined {
  if (
    node &&
    node.$impostureLang?.dataType === 'array-literal' &&
    node.children?.length === 1 &&
    node.children[0].$impostureLang?.dataType === 'string'
  ) {
    const theElderSibling = findAnElderSibling(node);
    const propertyNameOffset = node.children[0].offset + 1;
    const propertyNameLength = (node.children[0].length || 2) - 2;
    const identifierName = codeDocument.text.substr(propertyNameOffset, propertyNameLength);
    if (theElderSibling && theElderSibling.$impostureLang?.dataType === 'punctuation') {
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
      };
    }
  }
  return;
}

export function isForwardBracketNotation(
  node: AzLogicAppNode,
  codeDocument: CodeDocument
): IdentifierInBracketNotationReturnChainType | undefined {
  if (
    node &&
    node.$impostureLang?.dataType === 'array-literal' &&
    node.children?.length === 1 &&
    node.children[0].$impostureLang?.dataType === 'string'
  ) {
    const propertyNameOffset = node.children[0].offset + 1;
    const propertyNameLength = (node.children[0].length || 2) - 2;
    const identifierName = codeDocument.text.substr(propertyNameOffset, propertyNameLength);
    return {
      type: 'array-literal',
      isBracketNotation: true,
      label: identifierName,
      identifierName,
      punctuationNode: node as any,
      node: node,
      propertyNameNode: node.children[0] as any,
      propertyNameOffset,
      propertyNameLength,
    };
  }
  return;
}

export function findCompleteIdentifiersChain(
  node: AzLogicAppNode,
  codeDocument: CodeDocument
): {
  head: AzLogicAppNode;
  tail: AzLogicAppNode;
  chain: ReturnChainType[];
} {
  const chain: ReturnChainType[] = [];

  if (
    node.$impostureLang?.dataType === 'object-identifiers-captures' ||
    node.$impostureLang?.dataType === 'identifiers-capture'
  ) {
    node = findOneStepCaptureOwner(node) as any;
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
      const isBracketNotationRes = isBracketNotation(oneElderSibling, codeDocument);
      if (isBracketNotationRes) {
        chain.unshift(isBracketNotationRes);
        oneElderSibling = findAnElderSibling(isBracketNotationRes.punctuationNode);
        continue;
      } else {
        break;
      }
    }
    chain.unshift(getNodeReturnType(oneElderSibling, codeDocument));
    oneElderSibling = findAnElderSibling(oneElderSibling);
  }

  if (oneElderSibling) {
    const theUltimateReturnType = getNodeReturnType(oneElderSibling, codeDocument);
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

export function findCompleteForwardIdentifiersChain(
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
    node = findOneStepCaptureOwner(node) as any;
  }

  if (node) {
    const curReturnType = getNodeReturnType(node, codeDocument);
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

  let oneYoungerSibling: AzLogicAppNode | undefined = findAYoungerSibling(node);
  while (
    oneYoungerSibling?.$impostureLang?.dataType === 'object-identifiers:wPunctuation' ||
    oneYoungerSibling?.$impostureLang?.dataType === 'identifiers:wPunctuation' ||
    oneYoungerSibling?.$impostureLang?.dataType === 'array-literal'
  ) {
    tail = oneYoungerSibling;
    if (oneYoungerSibling?.$impostureLang?.dataType === 'array-literal') {
      // todo fix this array-literal
      // to check punctuation
      const isBracketNotationRes = isForwardBracketNotation(oneYoungerSibling, codeDocument);
      if (isBracketNotationRes) {
        chain.push(isBracketNotationRes);
        oneYoungerSibling = findAYoungerSibling(isBracketNotationRes.punctuationNode);
        continue;
      } else {
        break;
      }
    }
    chain.push(getNodeReturnType(oneYoungerSibling, codeDocument));
    oneYoungerSibling = findAYoungerSibling(oneYoungerSibling);
  }

  return {
    head,
    tail,
    chain,
  };
}

export function checkParenthesesElderSibling(node: AzLogicAppNode): ParenthesesElderSiblingType {
  if (node.$impostureLang?.dataType === 'parentheses') {
    const theElderSibling = findAnElderSibling(node);
    if (theElderSibling?.$impostureLang?.dataType === 'function-call') {
      return ParenthesesElderSiblingType.FUNCTION_CALL;
    }
    return ParenthesesElderSiblingType.BENEATH_A_PAIR_OF_PARENTHESES;
  }
  return ParenthesesElderSiblingType.NOT_FOUND;
}

export function amongFunctionCall(node: AzLogicAppNode | undefined) {
  if (node) {
    const visited: AzLogicAppNode[] = [];
    let parenthesesCheckResult: ParenthesesElderSiblingType = ParenthesesElderSiblingType.NOT_FOUND;
    let found = false;

    let head = node;
    let directChild: AzLogicAppNode | undefined = undefined;
    while (head && !found) {
      visited.unshift(head as AzLogicAppNode);
      const chkRes = checkParenthesesElderSibling(head);
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

export function listCommaIndicesOfParenthesesChildren(children?: AzLogicAppNode[]) {
  const result: number[] = [];
  children?.forEach((value, index) => {
    if (value.$impostureLang?.dataType === 'comma') {
      result.push(index);
    }
  });
  return result;
}

export function inferIdentifierTypeFromChain(
  symbolTable: SymbolTable,
  codeDocument: CodeDocument,
  idChain: ReturnChainType[]
): IdentifierType | undefined {
  if (idChain.length === 0) return;
  if (idChain[0].type === 'function-call-complete') {
    const functionFullName = idChain[0].functionFullName;
    const theFunDesc = findAmongOneDescriptor(symbolTable, functionFullName.split('.'));

    if (theFunDesc) {
      const retIdTyp: IdentifierType | undefined = determineReturnIdentifierTypeOfFunction(
        symbolTable,
        codeDocument,
        idChain[0].node as any,
        theFunDesc
      );

      if (retIdTyp) {
        if (retIdTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE && retIdTyp.returnTypeChainList?.length) {
          const theReturnValueDesc = findAmongOneDescriptor(symbolTable,[
            ...retIdTyp.returnTypeChainList,
            ...(idChain.slice(1) as (IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType)[]).map(
              (value) => value.identifierName
            ),
          ]);
          if (theReturnValueDesc && theReturnValueDesc._$type === DescriptionType.ReferenceValue) {
            return theReturnValueDesc._$valueType;
          }else if (
            // check em all in case we gonna support more
            theReturnValueDesc && theReturnValueDesc._$type === DescriptionType.FunctionValue ||
            theReturnValueDesc && theReturnValueDesc._$type === DescriptionType.OverloadedFunctionValue ||
            theReturnValueDesc && theReturnValueDesc._$type === DescriptionType.PackageReference
          ){
            return theReturnValueDesc._$identifierType;
          }
        } else if (!retIdTyp.isComposite) {
          return retIdTyp;
        }
      }
    }
  } else if ('identifierName' in idChain[0] && idChain[0].identifierName) {
    const packagePaths = (idChain as (IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType)[]).map(
      (value) => value.identifierName
    );
    const theRefDesc = findAmongOneDescriptor(symbolTable, packagePaths);
    if (theRefDesc?._$type === DescriptionType.ReferenceValue) {
      if (theRefDesc._$valueType.type === IdentifierTypeName.OBJECT) {
        // todo: ooops, currently we cannot support non-primitive identifier type
        // will be fixed once we switched from enum id type to class based identifier type
      } else if (!theRefDesc._$valueType.isComposite) {
        return theRefDesc._$valueType;
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
  return;
}

export function populateVarParaIncreasingly(arr: IdentifierType[], varArgIndex: number) {
  if (varArgIndex < arr.length && arr[varArgIndex].isVarList) {
    arr.splice(varArgIndex, 0, arr[varArgIndex]);
  }
}

export function determineOverloadFunParamSeq(
  symbolTable: SymbolTable,
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
    const commaIndices = listCommaIndicesOfParenthesesChildren(
      parenthesesNode.children as AzLogicAppNode[] | undefined
    );
    // check para size
    const sizeMatchingParaCandidates = curParaCandidates.filter(
      (value) => value.length - 1 === commaIndices.length + 1
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
            : findAYoungerSibling(parenthesesNode.children[commaIndices[paraIndex]] as any);
        if (oneParaNode) {
          const oneIdChain = findCompleteForwardIdentifiersChain(oneParaNode as any, codeDocument);
          const sourceIdTyp = inferIdentifierTypeFromChain(symbolTable, codeDocument, oneIdChain.chain);
          curParaCandidates = curParaCandidates.filter((value) => {
            if (paraIndex < value.length - 1) {
              if (value[paraIndex].isVarList) {
                populateVarParaIncreasingly(value, paraIndex);
              }
              const targetIdTyp = value[paraIndex];
              return(
                  targetIdTyp.type === IdentifierTypeName.CONSTANT &&
                  targetIdTyp.constantStringValue === codeDocument.getNodeContent(oneParaNode)
                ) ||
                sourceIdTyp?.assignableTo(targetIdTyp);
            }
            return false;
          });
        } else {
          // unexpected tokens found
          break;
        }
        paraIndex++;
        if (!curParaCandidates.length) return 0;
        return curParaCandidates[0][curParaCandidates[0].length - 1] as unknown as number;
      }
    }
  }
  // return the first para if no candidate found
  return 0;
}

export function determineReturnIdentifierTypeOfFunction(
  symbolTable: SymbolTable,
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
    const paramIndex = determineOverloadFunParamSeq(symbolTable, codeDocument, funNode, functionValueDescription);
    if (paramIndex < functionValueDescription._$returnType.length) {
      retTyp = functionValueDescription._$returnType[paramIndex];
    }
  }
  return retTyp;
}
//#endregion

//----------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------
//***********************************************\(￣︶￣*\))************************************************************
//----------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------

//#region value utils

export function createSymbolTable(
  base: Record<string, ValueDescription>,
  funRetTyp: {[SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME]: PackageDescription} = AzLogicAppLangConstants.emtpyFunRetTyp
):SymbolTable{
  return {
    ...createPkgValDesc([],{
      ...AzLogicAppLangConstants.globalSymbolTableBase,
      ...base,
    }),
    ...funRetTyp
  }
}

export function isValueDescriptor(node: any) {
  return (
    node?._$type &&
    (node._$type === DescriptionType.FunctionValue ||
      node._$type === DescriptionType.OverloadedFunctionValue ||
      node._$type === DescriptionType.PackageReference ||
      node._$type === DescriptionType.ReferenceValue)
  );
}

export function traverseDescriptor(
  descriptor: ValueDescription,
  paths: string[],
  cb: (paths: string[], vd: ValueDescription) => void
) {
  paths = paths.slice();
  if (isValueDescriptor(descriptor)) {
    switch (descriptor._$type) {
      case DescriptionType.FunctionValue:
      case DescriptionType.OverloadedFunctionValue:
      case DescriptionType.ReferenceValue:
        cb(paths, descriptor);
        break;
      case DescriptionType.PackageReference:
        for (const [key, value] of Object.entries(descriptor._$subDescriptor)) {
          if (!key.startsWith('_$')) {
            traverseDescriptor(value, [...paths, key], cb);
          }
        }
        break;
    }
  }
  return;
}

export function generateValueDescriptionDictionary(descriptor: SymbolTable): ValueDescriptionDictionary {
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

  function saveToDescriptionDictionary(paths: string[], vd: ValueDescription) {
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
            const retValDesc = findAmongOneDescriptor(descriptor, vd._$returnType.returnTypeChainList);
            // if the return description existed, we could populate items traversing the description
            if (retValDesc) {
              traverseDescriptor(retValDesc, [], (rtPaths, rtVd) => {
                if (rtVd._$type === DescriptionType.ReferenceValue) {
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
              const retValDesc = findAmongOneDescriptor(
                descriptor,
                vd._$returnType[olRtIndex].returnTypeChainList!
              );
              // if the return description existed, we could populate items traversing the description
              if (retValDesc) {
                traverseDescriptor(retValDesc, [], (olRtPaths, olRtVd) => {
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
        if (vd._$valueType.type === IdentifierTypeName.OBJECT) {
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
        // should never reach over here
        break;
    }
  }

  // traverseDescriptor(descriptor._$functionReturnType, ['_$functionReturnType'], saveToDescriptionDictionary)
  traverseDescriptor(descriptor, [], saveToDescriptionDictionary);

  // todo might need to wrap it into a frozen map
  return result;
}

// todo rename into findAmongOneSymbolTable
export function findAmongOneDescriptor(descriptor: SymbolTable, paths: string[]): ValueDescription | undefined {
  if (!paths.length) return;
  paths = paths.slice();

  const firstPath = paths.shift();
  if (!firstPath) return;
  let valDesc: ValueDescription | undefined = undefined;
  if (firstPath === SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME && firstPath in descriptor) {
    valDesc = descriptor[firstPath];
  } else if (descriptor._$type === DescriptionType.PackageReference) {
    valDesc = descriptor._$subDescriptor[firstPath];
  }
  if (!valDesc) return;

  let cur = valDesc;
  let curPath = paths.shift();
  while (cur && curPath && cur._$type === DescriptionType.PackageReference) {
    cur = cur._$subDescriptor[curPath];
    curPath = paths.shift();
  }
  if (isValueDescriptor(cur)) {
    if (cur._$type === DescriptionType.ReferenceValue) {
      if (cur._$valueType.isAnyObject) {
        return cur;
      }
    }
    if (paths.length === 0) return cur;
  }
  return;
}

export function findAllAmongOneSymbolTable(descriptor: SymbolTable, paths: string[]):ValueDescription[]{
  const valDescArr:ValueDescription[] = [];
  if (!paths.length) return valDescArr;
  paths = paths.slice();

  const firstPath = paths.shift();
  if (!firstPath) return;
  let valDesc: ValueDescription | undefined = undefined;
  if (firstPath === SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME && firstPath in descriptor) {
    valDesc = descriptor[firstPath];
  } else if (descriptor._$type === DescriptionType.PackageReference) {
    valDesc = descriptor._$subDescriptor[firstPath];
  }
  if (!valDesc) return valDescArr;

  let cur = valDesc;
  valDescArr.push(cur);
  let curPath = paths.shift();
  while (cur && curPath && cur._$type === DescriptionType.PackageReference) {
    cur = cur._$subDescriptor[curPath];
    valDescArr.push(cur);
    curPath = paths.shift();
  }
  if (isValueDescriptor(cur)) {
    if (cur._$type === DescriptionType.ReferenceValue) {
      if (cur._$valueType.isAnyObject) {
        return valDescArr;
      }
    }
    if (paths.length === 0) return valDescArr;
  }
  return  [];
}

export function collectAllPathBeneathOneDescriptorNode(
  descriptorNode: ValueDescription,
  paths: string[],
  collector: DescriptorCollection[]
) {
  if (!descriptorNode) return;
  if (descriptorNode._$type === DescriptionType.PackageReference) {
    for (const [key, value] of Object.entries(descriptorNode._$subDescriptor)) {
      if (!key.startsWith('_$')) {
        collectAllPathBeneathOneDescriptorNode(value, [...paths, key], collector);
      }
    }
  } else {
    collector.push({
      paths: paths.slice(),
      valDescCollItem: new DescCollItem(descriptorNode),
    });
  }
  return;
}

export function findAllPathAmongOneDescriptor(descriptor: ValueDescription, paths: string[]): DescriptorCollection[] {
  const collector: DescriptorCollection[] = [];
  const originalPathsCopy = paths.slice();
  paths = paths.slice();
  let cur = descriptor;
  if (paths.length) {
    let curPath = paths.shift();
    while (cur && curPath && cur._$type === DescriptionType.PackageReference) {
      cur = cur._$subDescriptor[curPath];
      curPath = paths.shift();
    }
  }
  if (paths.length === 0) {
    collectAllPathBeneathOneDescriptorNode(cur, originalPathsCopy, collector);
  }
  return collector;
}

export function findValueDescriptionFromChain(
  symbolTable: SymbolTable,
  codeDocument: CodeDocument,
  idChain: ReturnChainType[]
): ValueDescription | undefined {
  if (idChain.length === 0) return;
  if (idChain[0].type === 'function-call-complete') {
    const functionFullName = idChain[0].functionFullName;
    const theFunDesc = findAmongOneDescriptor(symbolTable, functionFullName.split('.'));
    if (theFunDesc) {
      const retTyp: IdentifierType | undefined = determineReturnIdentifierTypeOfFunction(
        symbolTable,
        codeDocument,
        idChain[0].node as any,
        theFunDesc
      );
      if (retTyp && retTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE && retTyp.returnTypeChainList?.length) {
        // todo, enhancement: it would be a lot of better to return which part of the chain not found
        return findAmongOneDescriptor(symbolTable, [
          ...retTyp.returnTypeChainList,
          ...(idChain.slice(1) as (IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType)[]).map(
            (value) => value.identifierName
          ),
        ]);
      }
    }
  } else if ('identifierName' in idChain[0] && idChain[0].identifierName) {
    return findAmongOneDescriptor(symbolTable,
      (idChain as (IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType)[]).map(
        (value) => value.identifierName
      )
    );
  }
  return;
}

export function findValDescArrFromChain(
  symbolTable: SymbolTable,
  codeDocument: CodeDocument,
  idChain: ReturnChainType[],
):ValueDescription[]{
  if (idChain.length === 0) return [];
  if (idChain[0].type === 'function-call-complete') {
    const functionFullName = idChain[0].functionFullName;
    const theFunDesc = findAmongOneDescriptor(symbolTable, functionFullName.split('.'));
    if (theFunDesc) {
      const retTyp: IdentifierType | undefined = determineReturnIdentifierTypeOfFunction(
        symbolTable,
        codeDocument,
        idChain[0].node as any,
        theFunDesc
      );
      if (retTyp){
        if (retTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE && retTyp.returnTypeChainList?.length) {
          // todo, enhancement: it would be a lot of better to return which part of the chain not found
          const funResult = findAllAmongOneSymbolTable(symbolTable, [
            ...retTyp.returnTypeChainList,
            ...(idChain.slice(1) as (IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType)[]).map(
              (value) => value.identifierName
            ),
          ]);
          if (funResult.length >= retTyp.returnTypeChainList.length){
            return funResult.slice(retTyp.returnTypeChainList.length -1);
          }else {
            return []
          }
        }else {
          // regular ret typ, just create a reference vd
          return [createRefValDesc(
            [`Return value of ${functionFullName}`],
            retTyp
          )]
        }
      }
    }
  } else if ('identifierName' in idChain[0] && idChain[0].identifierName) {
    return findAllAmongOneSymbolTable(symbolTable,
      (idChain as (IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType)[]).map(
        (value) => value.identifierName
      )
    );
  }
  return [];
}

export function findAllRootPackageOfOneDescriptor(
  descriptor: SymbolTable
): DescriptorCollection<[string]>[] {
  const collector: DescriptorCollection<[string]>[] = [];
  if (descriptor._$type === DescriptionType.PackageReference) {
    for (const [key, value] of Object.entries(descriptor._$subDescriptor)) {
      if (!key.startsWith('_$') && isValueDescriptor(value)) {
        const vd = value as ValueDescription;
        switch (vd._$type) {
          case DescriptionType.OverloadedFunctionValue:
            vd._$parameterTypes.forEach((_val, index) => {
              collector.push({
                paths: [key],
                valDescCollItem: new OlFunDescCollItem(vd, index),
              });
            });
            break;
          case DescriptionType.FunctionValue:
          case DescriptionType.PackageReference:
          case DescriptionType.ReferenceValue:
            // todo populate empty para fun return refs
            collector.push({
              paths: [key],
              valDescCollItem: new DescCollItem(vd),
            });
            break;
        }
      }
    }
  }
  return collector;
}

//#endregion
