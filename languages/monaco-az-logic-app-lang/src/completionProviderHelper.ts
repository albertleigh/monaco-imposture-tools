import {CancellationToken, editor, languages, Position, Range} from './editor.api';
import {AzLogicAppLangConstants, AzLogicAppNode,} from './base';
import {
  AbstractReturnChainType,
  IdentifierInBracketNotationReturnChainType,
  IdentifierReturnChainType,
  ReturnChainType,
} from './azLgcNodesUtils';
import {
  DescCollItem,
  DescCollItemTyp,
  DescriptionType,
  DescriptorCollection,
  IdentifierType,
  IdentifierTypeName,
  OlFunDescCollItem,
  PackageDescription,
  ReferenceValueDescription,
  SymbolTable,
  ValueDescription,
  ValueDescriptionDictionary,
  ValueDescriptionDictionaryFunctionKey,
  ValueDescriptionPath
} from './values';
import {
  AccessorPunctuator,
  AtSymbolNode,
  AzLgcExpDocument,
  CommaPunctuator,
  ExpressionTemplateNode,
  FunctionCallNode,
  FunctionCallTarget,
  IdentifierNode,
  IdentifierNodeInBracketNotation,
  LiteralArrayNode,
  LiteralNumberNode,
  LiteralStringNode,
  ParenthesisNode,
  RootFunctionCallNode
} from "./parser";

export enum CompletionType {
  UNKNOWN = 0x000,
  FUNCTION_CALL = 0x001,
  FUNCTION_PARAMETER = 0x002,
  PROPERTY = 0x003,
  IDENTIFIER_IN_BRACKETS = 0x004,
}

function getFunctionParaCntFromDc(dci: DescCollItemTyp): number {
  if (dci.type === 'basic' && dci.vd!._$type === DescriptionType.FunctionValue) {
    const funVd = dci.vd;
    return funVd._$parameterTypes.length;
  } else if (dci.type === 'overloadedFunction') {
    const olFunVd = dci.overloadedFunVd;
    return olFunVd._$parameterTypes[dci.overloadedIndex].length;
  }
  return 0;
}

function buildFunctionLabelWithPara(paths: ValueDescriptionPath[], dci: DescCollItemTyp): string {
  const pathName = ValueDescriptionPath.buildPathString(paths);
  let result = pathName;
  if (dci.type === 'basic' && dci.vd._$type === DescriptionType.FunctionValue) {
    const funVd = dci.vd;
    const paramLabel =
      dci.areAllParaConstant?
        funVd._$parameterTypes.map(value => value.constantStringValue).join(', '):
        funVd._$parameterTypes.map((value) => value.label).join(', ');
    const retLabel = funVd._$returnType.label;
    result = `${pathName}(${paramLabel}):${retLabel}`;
  } else if (dci.type === 'overloadedFunction') {
    const olFunVd = dci.overloadedFunVd!;
    const paramLabel =
      dci.areAllParaConstant?
        olFunVd._$parameterTypes[dci.overloadedIndex].map((value) => value.constantStringValue).join(', '):
        olFunVd._$parameterTypes[dci.overloadedIndex].map((value) => value.label).join(', ');
    const retLabel = olFunVd._$returnType[dci.overloadedIndex].label;
    result = `${pathName}(${paramLabel}):${retLabel}`;
  } else if (dci.type == 'emptyParaFunctionReturn'){
    const retPath = dci.returnPath || [];
    if (retPath.length){
      result = `${pathName}().${ValueDescriptionPath.buildPathString(retPath)}`
    }else{
      result = `${pathName}()`
    }
  }
  return result;
}

function buildCompletionItemKindFromValueDescription(vd: ValueDescription): languages.CompletionItemKind {
  switch (vd._$type) {
    case DescriptionType.OverloadedFunctionValue:
    case DescriptionType.FunctionValue:
      return AzLogicAppLangConstants._monaco.languages.CompletionItemKind.Function;
    case DescriptionType.ReferenceValue:
      return AzLogicAppLangConstants._monaco.languages.CompletionItemKind.Variable;
    case DescriptionType.PackageReference:
      return AzLogicAppLangConstants._monaco.languages.CompletionItemKind.Reference;
  }
  return AzLogicAppLangConstants._monaco.languages.CompletionItemKind.User;
}

function buildCompletionItemFromDescriptorCollectionEntry(
  contentRange: Range,
  dciPaths: ValueDescriptionPath[],
  dci: DescCollItemTyp,
  option: Partial<{
    endWithComma: boolean;
  }> = {}
) {
  const paramComma = option?.endWithComma ? ', ' : '';

  if (dci.type === 'emptyParaFunctionReturn') {
    const funVd = dci.funVd;
    const returnVd = dci.returnVd;
    // const funVdDesc = vdCi.funVd?._$desc!
    // const isOlFun = typeof vdCi.overloadedFunParaIndex === 'number';
    const pathsStr = `${ValueDescriptionPath.buildPathString(dciPaths)}().${ValueDescriptionPath.buildPathString(dci.returnPath)}`;
    return {
      label: pathsStr,
      kind: buildCompletionItemKindFromValueDescription(dci.funVd),
      insertText: `${pathsStr}${paramComma}`,
      detail: returnVd._$desc[0],
      documentation: [...(returnVd._$desc || []), ...(funVd._$desc || [])].join('\n'),
      range: contentRange,
    };
  } else if (
    dci.type === 'overloadedFunction' ||
    (dci.type === 'basic' && dci.vd._$type === DescriptionType.FunctionValue)
  ) {
    const paths = ValueDescriptionPath.buildPathString(dciPaths);
    const innerParaCommas =
      dci.areAllParaConstant?
        dci.functionParameters.map(value => value.constantStringValue).join(', '):
        new Array(getFunctionParaCntFromDc(dci)).fill('').join(', ');
    return {
      label: buildFunctionLabelWithPara(dciPaths, dci),
      kind: AzLogicAppLangConstants._monaco.languages.CompletionItemKind.Function,
      insertText: `${paths}(${innerParaCommas})${paramComma}`,
      range: contentRange,
    };
  } else {
    // primitive basic
    const label = ValueDescriptionPath.buildPathString(dciPaths);
    const vd = dci.vd;
    return {
      label,
      kind: buildCompletionItemKindFromValueDescription(vd),
      insertText: `${label}${paramComma}`,
      detail: vd._$desc.length? vd._$desc[0]: undefined,
      documentation: vd._$desc.length? vd._$desc.join('\n'): undefined,
      range: contentRange,
    };
  }
}

function generateCompletionListByNonCompositeType(
  identifierType: IdentifierType,
  contentRange: Range,
  endWithComma = false,
  valueDescriptionDict: ValueDescriptionDictionary
): languages.CompletionList | undefined {
  if (identifierType.isComposite) return;
  const allRetTypCandidates: IdentifierType[] = identifierType.returnTypeCandidates;

  let collectionOfParamType: DescriptorCollection[] = [];

  allRetTypCandidates.forEach((value) => {
    const oneSetOfColl = valueDescriptionDict.get(value);
    collectionOfParamType = oneSetOfColl ? collectionOfParamType.concat(oneSetOfColl) : collectionOfParamType;
  });

  if (collectionOfParamType && collectionOfParamType.length) {
    // alright we got suggestions
    return {
      suggestions: collectionOfParamType
        .filter(
          (value) =>
            // we need not support overloadedFunction completion for primitive fields
            value.valDescCollItem.type === 'basic' || value.valDescCollItem.type === 'emptyParaFunctionReturn'
        )
        .map((value) => {
          // if (value.valDescCollItem.type === 'emptyParaFunctionReturn'){}
          // else //basic
          return buildCompletionItemFromDescriptorCollectionEntry(contentRange, value.paths, value.valDescCollItem, {
            endWithComma,
          });
        }),
    };
  }
}

function generateCompletionListByConstantArray(
  constantArr:IdentifierType[],
  contentRange: Range,
): languages.CompletionList | undefined{
  return {
    suggestions: constantArr
      .filter(value => value.type === IdentifierTypeName.CONSTANT)
      .map(value => ({
        label: value.constantStringValue,
        insertText: value.constantStringValue,
        kind: AzLogicAppLangConstants._monaco.languages.CompletionItemKind.Constant,
        range: contentRange,
      }))
  }
}

export interface EditorSupportingAzLgcExpCompletion{
  valueDescriptionDict:ValueDescriptionDictionary,
  rootSymbolTable:SymbolTable,
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateCompletion(
  theLgcExpDocEditor: EditorSupportingAzLgcExpCompletion,
  azLgcExpDoc: AzLgcExpDocument,
  model: editor.ITextModel,
  position: Position,
  context: languages.CompletionContext,
  token: CancellationToken
): languages.CompletionList {
  let completionKind: CompletionType = CompletionType.UNKNOWN;
  // for function call
  let functionFullName = '';
  // function call target and its identifiers
  let functionCall:FunctionCallNode | undefined;
  let funCallTarget:FunctionCallTarget | undefined;
  // for parentheses
  let parenthesesNode: ParenthesisNode| undefined;
  let paramIndex = 0;
  // for identifiers
  let identifiersChain: ReturnChainType[] = [];

  const offset = model.getOffsetAt(position);

  const originalAstNode = azLgcExpDoc.codeDocument.getNodeByOffset(offset) as AzLogicAppNode;
  const originalNode = azLgcExpDoc.getSyntaxNodeByOffset(offset);

  AzLogicAppLangConstants.inSemanticDebugMode && console.log('[generateCompletion]', offset, originalNode, originalAstNode);

  if (
    originalNode instanceof AtSymbolNode ||
    (
      originalNode instanceof ExpressionTemplateNode &&
        originalNode.content.length === 0 &&
        originalNode.offset+2 <= offset &&
        originalNode.offset + originalNode.length -1  >= offset
    )
  ) {
    // populate the whole functions list directly
    const startPos = model.getPositionAt(offset);
    const endPos = model.getPositionAt(offset);
    const contentRange = new AzLogicAppLangConstants._monaco.Range(
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    );
    // const content = model.getValueInRange(contentRange);
    const allFunctionCollection = theLgcExpDocEditor.valueDescriptionDict.get(ValueDescriptionDictionaryFunctionKey)!;
    if (allFunctionCollection.length) {
      const result = {
        suggestions: allFunctionCollection.map((value) => {
          const paths = ValueDescriptionPath.buildPathString(value.paths);
          const valDci = value.valDescCollItem as (DescCollItem|OlFunDescCollItem);
          // const vd = value.valueDescription;
          const paraCommas =
            valDci.areAllParaConstant?
              valDci.functionParameters.map(funParaIdTyp => funParaIdTyp.constantStringValue).join(', '):
              new Array(getFunctionParaCntFromDc(valDci)).fill('').join(', ');
          return {
            label: buildFunctionLabelWithPara(value.paths, value.valDescCollItem),
            kind: AzLogicAppLangConstants._monaco.languages.CompletionItemKind.Function,
            insertText: `${paths}(${paraCommas})`,
            range: contentRange,
          };
        }),
      };
      AzLogicAppLangConstants.inSemanticDebugMode &&
        console.log(
          '[generateCompletion::atSymbol]',
          offset,
          model.getValueInRange(contentRange),
          originalNode,
          startPos,
          endPos,
          result.suggestions
        );
      return result;
    }
  }

  let node = originalNode;

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // switch to semantic nodes and prepare mete data from semantic nodes

  if (node) {
    // turn to other semantic nodes in an expression
    if (node instanceof CommaPunctuator) {
      if (
        offset == node.offset &&
        node.elderSibling
      ){
        if (
          node.parent instanceof ParenthesisNode &&
          node.elderSibling.offset+node.elderSibling.length === offset
        ){
          node = node.elderSibling;
        }else{
          node = node.elderSibling;
        }
      }else if (
        offset == node.offset + node.length &&
        node.youngerSibling
      ){
        if (
          node.parent instanceof ParenthesisNode &&
          node.youngerSibling.offset === offset
        ){
          node = node.youngerSibling;
        }else{
          node = node.youngerSibling;
        }
      }
    }

    // turn to its father when encountering  accessors
    if (node instanceof AccessorPunctuator){
      if (node.elderSibling){
        node = node.elderSibling;
      }
    }

    // determine the completion type

    if (
      node instanceof RootFunctionCallNode &&
      node.atSymbolNode.offset + node.atSymbolNode.length <= offset
    ){
      if (
        node.innerFunctionCallNode &&
        node.innerFunctionCallNode.offset + node.innerFunctionCallNode.length <= offset
      ){
        functionCall = node.innerFunctionCallNode;
        const chain = AbstractReturnChainType.findCompleteIdentifiersChain(functionCall.astNode as any, azLgcExpDoc.codeDocument);
        if (chain.chain.length) {
          identifiersChain = chain.chain;
          completionKind = CompletionType.PROPERTY;
        }
      }else {
        // root function after at symbol
        const startPos = model.getPositionAt(node.atSymbolNode.offset + node.atSymbolNode.length);
        const endPos = model.getPositionAt(offset);
        const contentRange = new AzLogicAppLangConstants._monaco.Range(
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column
        );
        // const content = model.getValueInRange(contentRange);
        const allFunctionCollection = theLgcExpDocEditor.valueDescriptionDict.get(ValueDescriptionDictionaryFunctionKey)!;
        if (allFunctionCollection.length) {
          const result = {
            suggestions: allFunctionCollection.map((value) => {
              const paths = ValueDescriptionPath.buildPathString(value.paths);
              const valDci = value.valDescCollItem as (DescCollItem|OlFunDescCollItem);
              // const vd = value.valueDescription;
              const paraCommas =
                valDci.areAllParaConstant?
                  valDci.functionParameters.map(funParaIdTyp => funParaIdTyp.constantStringValue).join(', '):
                  new Array(getFunctionParaCntFromDc(valDci)).fill('').join(', ');
              return {
                label: buildFunctionLabelWithPara(value.paths, value.valDescCollItem),
                kind: AzLogicAppLangConstants._monaco.languages.CompletionItemKind.Function,
                insertText: `${paths}(${paraCommas})`,
                range: contentRange,
              };
            }),
          };
          AzLogicAppLangConstants.inSemanticDebugMode &&
          console.log(
            '[generateCompletion::incomplete root function call]',
            offset,
            model.getValueInRange(contentRange),
            originalNode,
            startPos,
            endPos,
            result.suggestions
          );
          return result;
        }
      }
    }else if (
      (
        node instanceof LiteralStringNode ||
        node instanceof LiteralNumberNode
      ) &&
      node.parent instanceof LiteralArrayNode &&
      node.parent.parent instanceof IdentifierNodeInBracketNotation &&
      node.parent.startPosOfItem(0) <= offset &&
      node.parent.endPosOfItem(0) >= offset
    ){
      node = node.parent.parent;
      completionKind = CompletionType.IDENTIFIER_IN_BRACKETS;
    }else if (
      node.parent instanceof FunctionCallNode &&
      Array.from(node.siblings).some(one => {
        if (one instanceof FunctionCallTarget){
          funCallTarget = one;
          return true;
        }
        return false;
      })
    ){
      functionCall = node.parent;
      node = node.parent;
      completionKind = CompletionType.FUNCTION_CALL;
    }else if (
      node instanceof FunctionCallNode &&
      node.offset+node.length === offset
    ){
      functionCall = node;
      const chain = AbstractReturnChainType.findCompleteIdentifiersChain(node.astNode as any, azLgcExpDoc.codeDocument);
      if (chain.chain.length) {
        identifiersChain = chain.chain;
        completionKind = CompletionType.PROPERTY;
      }
    }else if (
      node instanceof IdentifierNodeInBracketNotation &&
      node.offset < offset &&
      node.offset + node.length > offset
    ){
      // if (node.elderSibling){
      //   const chain = findCompleteIdentifiersChain(node.elderSibling.astNode as any, azLgcExpDoc.codeDocument);
      //   if (chain.chain.length){
      //     identifiersChain = chain.chain;
      //   }
      // }
      completionKind = CompletionType.IDENTIFIER_IN_BRACKETS;
    }else if (
      // function call target must have been turned into CompletionType.FUNCTION_CALL
      node instanceof IdentifierNode
    ){
      const chain = AbstractReturnChainType.findCompleteIdentifiersChain(node.astNode as any, azLgcExpDoc.codeDocument);
      if (chain.chain.length) {
        identifiersChain = chain.chain;
        completionKind = CompletionType.PROPERTY;
      }
    }else if (node instanceof FunctionCallNode){
      // unhandled function call
      functionCall = node;
      functionFullName = node.functionFullName;
      if (completionKind === CompletionType.UNKNOWN) {
        // property
        const chain = AbstractReturnChainType.findCompleteIdentifiersChain(
          functionCall.astNode as any, azLgcExpDoc.codeDocument
        );
        if (chain.chain.length) {
          identifiersChain = chain.chain;
          completionKind = CompletionType.PROPERTY;
        }
      }
    }else if (
      // todo "identifiers-capture" might be inappropriate over here, consider changing it
      originalAstNode.$impostureLang.dataType === "identifiers-capture" &&
      originalAstNode.parent.$impostureLang.dataType === "identifiers:wPunctuation" &&
      !(node instanceof IdentifierNode) &&
      node instanceof ParenthesisNode &&
      node.offset < offset &&
      node.offset + node.length > offset &&
      node.paramIndexByOffset(offset) > -1 &&
      node.parameter(node.paramIndexByOffset(offset))
    ){
      // incomplete identifier
      const thePara = node.parameter(node.paramIndexByOffset(offset));
      const chain = AbstractReturnChainType.findCompleteIdentifiersChain(
        thePara.astNode as any, azLgcExpDoc.codeDocument
      )
      if (chain.chain.length) {
        identifiersChain = chain.chain;
        completionKind = CompletionType.PROPERTY;
      }
    }else if(
      node instanceof ParenthesisNode &&
      node.parent instanceof FunctionCallNode &&
      node.offset < offset &&
      node.offset + node.length > offset
    ){
      parenthesesNode = node;
      paramIndex = parenthesesNode.paramIndexByOffset(offset);
      functionCall = node.parent;
      completionKind = CompletionType.FUNCTION_PARAMETER
    }else if (
      node instanceof ParenthesisNode &&
      offset === node.offset &&
      node.parent instanceof FunctionCallNode
    ){
      parenthesesNode = node;
      functionCall = node.parent;
      completionKind = CompletionType.FUNCTION_CALL;
      node = node.parent;
    }else if (
      node instanceof ParenthesisNode &&
      offset === node.offset + node.length &&
      node.parent instanceof FunctionCallNode
    ){
      parenthesesNode = node;
      functionCall = node.parent;
      const chain = AbstractReturnChainType.findCompleteIdentifiersChain(functionCall.astNode as any, azLgcExpDoc.codeDocument);
      if (chain.chain.length) {
        identifiersChain = chain.chain;
        completionKind = CompletionType.PROPERTY;
      }
    }else if (
      node instanceof ParenthesisNode &&
      offset === node.offset + node.length -1
    ){
      parenthesesNode = node;
      paramIndex = parenthesesNode.parameterSize -1;
      if (parenthesesNode.parameter(paramIndex)){
        // property
        const chain = AbstractReturnChainType.findCompleteIdentifiersChain(
          parenthesesNode.parameter(paramIndex).astNode as any, azLgcExpDoc.codeDocument
        );
        if (chain.chain.length) {
          identifiersChain = chain.chain;
          completionKind = CompletionType.PROPERTY;
        }
      }else if (
        parenthesesNode.parent instanceof FunctionCallNode
      ){
        // fun call parameter
        functionCall = parenthesesNode.parent;
        completionKind = CompletionType.FUNCTION_PARAMETER;
      }
    }else if (
      node.parent instanceof ParenthesisNode &&
      node.parent.parent instanceof FunctionCallNode
    ){
      parenthesesNode = node.parent;
      functionCall = node.parent.parent;
      paramIndex = parenthesesNode.paramIndexByOffset(offset);
      completionKind = CompletionType.FUNCTION_PARAMETER;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // do generate

    // handle supported completion kind
    switch (completionKind) {
      case CompletionType.FUNCTION_CALL:
        if (functionCall) {
          const firstFunCallId = functionCall.supportFunctionCallIdentifiers[0];
          const lastFunCallId = functionCall.supportFunctionCallIdentifiers[functionCall.supportFunctionCallIdentifiers.length -1];
          const startPos = model.getPositionAt(firstFunCallId.offset);
          const endPos = model.getPositionAt(lastFunCallId.offset + lastFunCallId.length);
          const contentRange = new AzLogicAppLangConstants._monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          );
          // const content = model.getValueInRange(contentRange);
          const allFunctionCollection = theLgcExpDocEditor.valueDescriptionDict.get(ValueDescriptionDictionaryFunctionKey)!;
          if (allFunctionCollection.length) {
            const result = {
              // cannot use buildCompletionItemFromDescriptorCollectionEntry, as we only wanna
              // suggest function names over here
              suggestions: allFunctionCollection.map((value) => {
                const paths = ValueDescriptionPath.buildPathString(value.paths);
                // const vd = value.valueDescription;
                return {
                  label: buildFunctionLabelWithPara(value.paths, value.valDescCollItem),
                  kind: AzLogicAppLangConstants._monaco.languages.CompletionItemKind.Function,
                  insertText: paths,
                  range: contentRange,
                };
              }),
            };
            AzLogicAppLangConstants.inSemanticDebugMode &&
              console.log(
                '[generateCompletion::FUNCTION_CALL]',
                offset,
                model.getValueInRange(contentRange),
                functionFullName,
                functionCall,
                node,
                functionCall.offset,
                functionCall.offset + functionCall.length,
                startPos,
                endPos,
                result.suggestions[0]
              );
            return result;
          }
        }
        break;
      case CompletionType.FUNCTION_PARAMETER:
        if (parenthesesNode) {
          const startOffset = parenthesesNode.startPosOfParameter(paramIndex);
          let endOffset = parenthesesNode.endPosOfParameter(paramIndex);
          if (offset > endOffset) {
            endOffset = offset;
          }
          let startPos = model.getPositionAt(startOffset);
          let endPos = model.getPositionAt(endOffset);
          let contentRange = new AzLogicAppLangConstants._monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          );
          let content = model.getValueInRange(contentRange);

          if (startOffset <= offset && endOffset >= offset && content.match(/^\s+$/)) {
            // all white space content, reset insert pos
            startPos = model.getPositionAt(offset);
            endPos = model.getPositionAt(offset);
            contentRange = new AzLogicAppLangConstants._monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column
            );
            content = model.getValueInRange(contentRange);
          }else if (
            originalAstNode.$impostureLang.dataType === "identifiers"
          ){
            startPos = model.getPositionAt(originalAstNode.offset);
            endPos = model.getPositionAt(originalAstNode.offset + originalAstNode.length || 0);
            contentRange = new AzLogicAppLangConstants._monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column
            );
            content = model.getValueInRange(contentRange);
          }

          if (functionCall) {
            const theFunDesc = functionCall.functionValueDescription;

            if (theFunDesc) {
              let paramTypes: IdentifierType[] | undefined = undefined;
              if (theFunDesc._$type === DescriptionType.FunctionValue) {
                paramTypes = theFunDesc._$parameterTypes;
              } else if (theFunDesc._$type === DescriptionType.OverloadedFunctionValue) {
                paramTypes = theFunDesc._$parameterTypes[functionCall.parameterSeq];
              }

              if (paramTypes && paramTypes.length) {
                // determine the type
                let theParamType: IdentifierType | undefined = undefined;
                if (paramIndex < paramTypes.length) {
                  theParamType = paramTypes[paramIndex];
                } else {
                  theParamType = paramTypes[paramTypes.length - 1].isVarList
                    ? paramTypes[paramTypes.length - 1]
                    : theParamType;
                }

                if (theParamType) {
                  // todo: support FUNCTION if needed
                  if (theParamType.type === IdentifierTypeName.CONSTANT){
                    // suggest constants
                    const constantsIdTypes: IdentifierType[]= [theParamType];
                    if (theFunDesc._$type === DescriptionType.OverloadedFunctionValue){
                      theFunDesc._$parameterTypes.forEach((olParaTypes, olParaIndex) => {
                        if (
                          olParaIndex !== functionCall.parameterSeq &&
                          olParaTypes[functionCall.parameterSeq]?.type === IdentifierTypeName.CONSTANT
                        ){
                          constantsIdTypes.push(olParaTypes[functionCall.parameterSeq]);
                        }
                      })
                    }
                    const result = generateCompletionListByConstantArray(constantsIdTypes, contentRange);
                    if (result) {
                      AzLogicAppLangConstants.inSemanticDebugMode &&
                      console.log(
                        '[generateCompletion::FUNCTION_PARAMETER] const arr',
                        offset,
                        content,
                        node,
                        startOffset,
                        endOffset,
                        startPos,
                        endPos,
                        result.suggestions
                      );
                      return result;
                    }
                  }else{
                    // general purpose completion suggestion
                    // warning, these might cause a problem once we fully support CONSTANT and FUNCTION id types
                    const result = generateCompletionListByNonCompositeType(
                      theParamType,
                      contentRange,
                      paramIndex >= parenthesesNode.parameterSize &&
                      ((paramIndex < paramTypes.length - 1) || (paramIndex < parenthesesNode.parameterSize -1 )),
                      theLgcExpDocEditor.valueDescriptionDict
                    );
                    if (result) {
                      AzLogicAppLangConstants.inSemanticDebugMode &&
                      console.log(
                        '[generateCompletion::FUNCTION_PARAMETER] gen',
                        offset,
                        content,
                        node,
                        startOffset,
                        endOffset,
                        startPos,
                        endPos,
                        result.suggestions
                      );
                      return result;
                    }
                  }
                }
              }
            }
          }
        }
        break;
      case CompletionType.PROPERTY:
        if (identifiersChain) {
          const vdPathArr = theLgcExpDocEditor.rootSymbolTable.findValDescArrFromChain(azLgcExpDoc.codeDocument, identifiersChain);
          if (
            identifiersChain.length > 0 &&
            identifiersChain.some((value, index) => (
              index !== 0 &&
              value instanceof IdentifierInBracketNotationReturnChainType &&
              vdPathArr[index -1].vd instanceof ReferenceValueDescription &&
              (vdPathArr[index -1].vd as ReferenceValueDescription)._$valueType.type === IdentifierTypeName.ARRAY_OF_TYPE
            ))
          ){
            // post any array of type completion suggestion
            let identifierInBracketNotationIndex = identifiersChain.length -1;
            while (
              identifierInBracketNotationIndex > -1 &&
              !(
                identifierInBracketNotationIndex !== 0 &&
                identifiersChain[identifierInBracketNotationIndex] instanceof IdentifierInBracketNotationReturnChainType &&
                vdPathArr[identifierInBracketNotationIndex -1].vd instanceof ReferenceValueDescription &&
                (vdPathArr[identifierInBracketNotationIndex -1].vd as ReferenceValueDescription)._$valueType.type === IdentifierTypeName.ARRAY_OF_TYPE
              )
            ){
              identifierInBracketNotationIndex--
            }


            if (
              // in range
              identifierInBracketNotationIndex >= 0 &&
              identifierInBracketNotationIndex < identifiersChain.length &&
              // not an unrecognized type
              !(
                vdPathArr[identifierInBracketNotationIndex] instanceof ReferenceValueDescription &&
                (vdPathArr[identifierInBracketNotationIndex].vd as ReferenceValueDescription)._$valueType.type === IdentifierTypeName.UNRECOGNIZED
              )
            ){
              const firstChainNode = identifiersChain[identifierInBracketNotationIndex];
              const lastPropertyNode = identifiersChain[identifiersChain.length - 1].node;
              const startOffset = firstChainNode.node.offset + firstChainNode.node.length;
              const endOffset = lastPropertyNode.offset + lastPropertyNode.length;
              const startPos = model.getPositionAt(startOffset);
              const endPos = model.getPositionAt(endOffset);
              const contentRange = new AzLogicAppLangConstants._monaco.Range(
                startPos.lineNumber,
                startPos.column,
                endPos.lineNumber,
                endPos.column
              );
              const content = model.getValueInRange(contentRange);
              let result:languages.CompletionList;

              const theReturnValueDescCollection: DescriptorCollection[] = [];
              vdPathArr[identifierInBracketNotationIndex].vd.collectAllPathBeneath([], theReturnValueDescCollection)
              if (theReturnValueDescCollection.length){
                result = {
                  suggestions: theReturnValueDescCollection.map(value => {
                    return buildCompletionItemFromDescriptorCollectionEntry(
                      contentRange,
                      [
                        new ValueDescriptionPath('', vdPathArr[identifierInBracketNotationIndex-1].vd),
                        ...value.paths
                      ],
                      value.valDescCollItem
                    )
                  })
                }
              }

              AzLogicAppLangConstants.inSemanticDebugMode &&
              console.log(
                '[generateCompletion::PROPERTY] post array of type',
                content,
                result,
                offset,
                startOffset,
                endOffset,
                identifiersChain,
                vdPathArr
              );
              return result;
            }
          }else if (
            identifiersChain.length > 0 &&
            originalAstNode.$impostureLang?.dataType === 'punctuation-capture' &&
            originalAstNode.offset + 1 === offset &&
            identifiersChain[identifiersChain.length - 1].node.offset +
              (identifiersChain[identifiersChain.length - 1].node.length || 0) ===
              offset - 1
          ) {
            // infer the type and suggest completions right after one punctuation

            // const firstChainNode = identifiersChain[0].node;
            // const lastPropertyNode = identifiersChain[identifiersChain.length-1].node;
            const startOffset = offset;
            const endOffset = offset;
            const startPos = model.getPositionAt(startOffset);
            const endPos = model.getPositionAt(endOffset);
            const contentRange = new AzLogicAppLangConstants._monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column
            );
            const content = model.getValueInRange(contentRange);
            let theReturnValueDescCollection: DescriptorCollection[] = [];

            const curRetVd = theLgcExpDocEditor.rootSymbolTable.findValueDescriptionFromChain(azLgcExpDoc.codeDocument, identifiersChain);
            if (curRetVd && curRetVd instanceof  PackageDescription) {
              theReturnValueDescCollection = curRetVd.findAndCollectAllBeneath([]);
            }
            if (theReturnValueDescCollection.length) {
              const result = {
                suggestions: theReturnValueDescCollection.map((value) => {
                  return buildCompletionItemFromDescriptorCollectionEntry(
                    contentRange,
                    value.paths,
                    value.valDescCollItem
                  );
                }),
              };
              AzLogicAppLangConstants.inSemanticDebugMode &&
                console.log(
                  '[generateCompletion::PROPERTY] post punctuation',
                  offset,
                  content,
                  identifiersChain,
                  startOffset,
                  endOffset,
                  startPos,
                  endPos,
                  result.suggestions
                );
              return result;
            }
          } else if (identifiersChain.length > 1) {
            // todo consider to directly infer after current identifier and suggest its completions
            // infer the whole chain and suggest completions from the second node of the chain

            // todo multiple properties, find all path beneath the package
            const firstChainNode = identifiersChain[0];
            const lastPropertyNode = identifiersChain[identifiersChain.length - 1].node;
            const startOffset = firstChainNode.node.offset + (firstChainNode.node.length || 0);
            const endOffset = lastPropertyNode.offset + (lastPropertyNode.length || 0);
            const startPos = model.getPositionAt(startOffset);
            const endPos = model.getPositionAt(endOffset);
            const contentRange = new AzLogicAppLangConstants._monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column
            );
            const content = model.getValueInRange(contentRange);
            let theReturnValueDescCollection: DescriptorCollection[] = [];
            let theReturnValueDescCollectionPathSliceStartIndex = 1;

            if (firstChainNode.type === 'function-call-complete') {
              // alright, if the first node were of function call type,
              // we gonna infer from function call return type
              const functionFullName = firstChainNode.functionFullName;
              const theFunDesc = azLgcExpDoc.globalSymbolTable.findByPath(functionFullName.split('.'));
              if (theFunDesc) {
                const funRetTyp = theLgcExpDocEditor.rootSymbolTable.determineReturnIdentifierTypeOfFunction(
                  azLgcExpDoc.codeDocument,
                  firstChainNode.node as AzLogicAppNode,
                  theFunDesc
                );

                if (
                  funRetTyp &&
                  funRetTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE &&
                  funRetTyp.returnTypeChainList?.length
                ) {
                  theReturnValueDescCollectionPathSliceStartIndex = funRetTyp.returnTypeChainList.length;
                  theReturnValueDescCollection = theLgcExpDocEditor.rootSymbolTable.findAndCollectAllBeneath(
                    [
                      ...funRetTyp.returnTypeChainList,
                      ...(
                        identifiersChain.slice(1) as (
                          | IdentifierInBracketNotationReturnChainType
                          | IdentifierReturnChainType
                          )[]
                      ).map((value) => value.identifierName),
                    ]
                  );
                }
              }
            } else if ('identifierName' in firstChainNode && firstChainNode.identifierName) {
              // or it's just a regular package reference
              theReturnValueDescCollection = theLgcExpDocEditor.rootSymbolTable.findAndCollectAllBeneath(
                (identifiersChain as (IdentifierInBracketNotationReturnChainType | IdentifierReturnChainType)[]).map(
                  (value) => value.identifierName
                )
              );
            }

            if (theReturnValueDescCollection.length) {
              const result = {
                suggestions: theReturnValueDescCollection.map((value) => {
                  return buildCompletionItemFromDescriptorCollectionEntry(
                    contentRange,
                    [
                      new ValueDescriptionPath('', value.paths[theReturnValueDescCollectionPathSliceStartIndex-1].vd),
                      ...value.paths.slice(theReturnValueDescCollectionPathSliceStartIndex)
                    ],
                    value.valDescCollItem
                  );
                }),
              };
              AzLogicAppLangConstants.inSemanticDebugMode &&
                console.log(
                  '[generateCompletion::PROPERTY] multiple',
                  offset,
                  content,
                  lastPropertyNode,
                  identifiersChain,
                  startOffset,
                  endOffset,
                  startPos,
                  endPos,
                  result.suggestions
                );
              return result;
            }
          } else {
            // the identifiersChain is of the size 1 of primitive return type and we gonna suggest all root packages

            const thePropertyNode = identifiersChain[0].node;
            let startOffset = thePropertyNode.offset;
            let endOffset = thePropertyNode.offset + (thePropertyNode.length || 0);
            let startPos = model.getPositionAt(startOffset);
            let endPos = model.getPositionAt(endOffset);
            let contentRange = new AzLogicAppLangConstants._monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column
            );
            let content = model.getValueInRange(contentRange);

            let theReturnValueDescCollection: DescriptorCollection[] = [];
            let theReturnValueDescCollectionPathSliceStartIndex = 1;
            let result:languages.CompletionList;

            if (identifiersChain[0].type === 'function-call-complete'){
              const functionFullName = identifiersChain[0].functionFullName;
              const theFunDesc = azLgcExpDoc.globalSymbolTable.findByPath(functionFullName.split('.'));
              if (theFunDesc) {
                const funRetTyp = theLgcExpDocEditor.rootSymbolTable.determineReturnIdentifierTypeOfFunction(
                  azLgcExpDoc.codeDocument,
                  identifiersChain[0].node as AzLogicAppNode,
                  theFunDesc
                );

                if (
                  funRetTyp &&
                  funRetTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE &&
                  funRetTyp.returnTypeChainList?.length
                ) {
                  theReturnValueDescCollectionPathSliceStartIndex = funRetTyp.returnTypeChainList.length;
                  theReturnValueDescCollection = theLgcExpDocEditor.rootSymbolTable.findAndCollectAllBeneath(
                    [
                      ...funRetTyp.returnTypeChainList,
                      ...(
                        identifiersChain.slice(1) as (
                          | IdentifierInBracketNotationReturnChainType
                          | IdentifierReturnChainType
                          )[]
                        // phase 2: todo fix it: this kind of suggestion won't contain the content like .a['b'].c
                      ).map((value) => value.identifierName),
                    ]);
                }
              }
            }
           if (theReturnValueDescCollection.length){
             const firstChainNode = identifiersChain[0];
             startOffset = firstChainNode.node.offset + (firstChainNode.node.length || 0);
             endOffset = startOffset;
             startPos = model.getPositionAt(startOffset);
             endPos = model.getPositionAt(endOffset);
             contentRange = new AzLogicAppLangConstants._monaco.Range(
               startPos.lineNumber,
               startPos.column,
               endPos.lineNumber,
               endPos.column
             );
             content = model.getValueInRange(contentRange);
             result = {
               suggestions: theReturnValueDescCollection.map((value) => {
                 return buildCompletionItemFromDescriptorCollectionEntry(
                   contentRange,
                   [
                     new ValueDescriptionPath('', value.paths[theReturnValueDescCollectionPathSliceStartIndex-1].vd),
                     ...value.paths.slice(theReturnValueDescCollectionPathSliceStartIndex)
                   ],
                   value.valDescCollItem
                 );
               }),
             };
           }else{
              const allRootPackages = theLgcExpDocEditor.rootSymbolTable.findAllRootPackage();
              result = {
                suggestions: allRootPackages
                  .filter((value) => value.valDescCollItem.type !== 'emptyParaFunctionReturn')
                  .map((value) => {
                    return buildCompletionItemFromDescriptorCollectionEntry(
                      contentRange,
                      value.paths,
                      value.valDescCollItem
                    );
                  }),
              };
            }
            AzLogicAppLangConstants.inSemanticDebugMode &&
              console.log(
                '[generateCompletion::PROPERTY] root one',
                offset,
                content,
                identifiersChain[0],
                startOffset,
                endOffset,
                startPos,
                endPos,
                result.suggestions
              );
            return result;
          }
        }
        break;
      case CompletionType.IDENTIFIER_IN_BRACKETS:
      {
        if (node instanceof IdentifierNodeInBracketNotation){
          const suggestions: languages.CompletionList['suggestions'] =[];

          const startPos = model.getPositionAt(node.literalArrayNode.startPosOfItem(0));
          const endPos = model.getPositionAt(node.literalArrayNode.endPosOfItem(0));
          const contentRange = new AzLogicAppLangConstants._monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          );
          const content = model.getValueInRange(contentRange);

          // iterate all direct sub package path if any
          if (
            node.elderSibling &&
            node.elderSibling.rValue
          ){
            let elderVd = node.elderSibling.rValue;
            if (
              elderVd._$type === DescriptionType.ReferenceValue &&
              elderVd._$valueType.type === IdentifierTypeName.FUNCTION_RETURN_TYPE
            ){
              elderVd = theLgcExpDocEditor.rootSymbolTable.findByPath(elderVd._$valueType.returnTypeChainList || []);
            }
            if (elderVd?._$type === DescriptionType.PackageReference){
              // Object.keys(elderVd._$subDescriptor)
              Array.from(elderVd.iterator()).filter(([key]) => !key.match(/^_\$.*/))
                .forEach(([oneField]) => {
                  suggestions.push({
                    label: `'${oneField}'`,
                    insertText: `'${oneField}'`,
                    kind: AzLogicAppLangConstants._monaco.languages.CompletionItemKind.Text,
                    range: contentRange,
                  })
                })
            }
          }

          // seize all string and number function call
          const allFunctionsReturningStringAndNumber = [
            ...theLgcExpDocEditor.valueDescriptionDict.get(IdentifierType.String),
            ...theLgcExpDocEditor.valueDescriptionDict.get(IdentifierType.Number)
          ];

          if (allFunctionsReturningStringAndNumber.length){
            allFunctionsReturningStringAndNumber.forEach((value) => {
              suggestions.push(buildCompletionItemFromDescriptorCollectionEntry(
                contentRange,
                value.paths,
                value.valDescCollItem
              ))
            });
          }

          const result = {suggestions};
          AzLogicAppLangConstants.inSemanticDebugMode &&
          console.log(
            '[generateCompletion::IDENTIFIER_IN_BRACKETS]',
            offset,
            content,
            node,
            startPos,
            endPos,
            startPos,
            endPos,
            result.suggestions
          );
          return result;
        }
      }
        break;
      case CompletionType.UNKNOWN:
        break;
    }
  }

  return {
    suggestions: [],
  };
}
