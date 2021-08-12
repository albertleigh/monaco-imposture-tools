import {CancellationToken, editor, languages, Position, Range} from "./editor.api";
import {CodeDocument} from "@monaco-imposture-tools/core";
import {
  AzLogicAppNode,
  AzLogicAppNodeType,
  DescriptionType,
  DescriptorCollection,
  DescriptorCollectionItem,
  FunctionValueDescription,
  IdentifierInBracketNotationReturnChainType,
  IdentifierReturnChainType,
  IdentifierType,
  IdentifierTypeName,
  ParenthesesElderSiblingType,
  ReturnChainType,
  ValueDescription,
  ValueDescriptionDictionaryFunctionKey
} from "./base";
import {
  amongFunctionCall,
  determineOverloadFunParamSeq,
  determinePostOffsetOfOneCommaBeneathParentheses,
  determinePreOffsetOfOneCommaBeneathParentheses,
  determineReturnIdentifierTypeOfFunction,
  findAnElderSibling,
  findCompleteIdentifiersChain,
  findFunctionCallNodeFromNode,
  getFunctionCallFullname
} from "./utils";
import {
  findAllPathAmongGlobal,
  findAllPathAmongOneDescriptor,
  findAllRootPackageOfOneDescriptor,
  findAmongGlobalDescription,
  findValueDescriptionFromChain,
  globalValueDescriptorDict
} from "./values";
import {AzLogicAppExpressionLangMonacoEditor} from "./editors";


export enum CompletionType{
  UNKNOWN                     = 0x000,
  FUNCTION_CALL               = 0x001,
  FUNCTION_PARAMETER          = 0x002,
  PROPERTY                    = 0x003,
}

function getFunctionParaCntFromDc(dc:DescriptorCollectionItem):number{
  if (dc.type === 'basic' && dc.vd!._$type === DescriptionType.FunctionValue){
    const funVd = dc.vd! as FunctionValueDescription;
    return funVd._$parameterTypes.length;
  }else if (dc.type === "overloadedFunction"){
    const olFunVd = dc.overloadedFunVd!;
    return olFunVd._$parameterTypes[dc.overloadedIndex!].length;
  }
  return 0;
}

function buildFunctionLabelWithPara(paths:string[], dc:DescriptorCollectionItem):string{
  const pathName = paths.join('.');
  let result = pathName;
  if (dc.type === 'basic' && dc.vd!._$type === DescriptionType.FunctionValue){
    const funVd = dc.vd! as FunctionValueDescription;
    const paramLabel = funVd._$parameterTypes.map(value => value.label).join(', ');
    const retLabel = funVd._$returnType.label;
    result = `${pathName}(${paramLabel}):${retLabel}`;
  }else if (dc.type === "overloadedFunction"){
    const olFunVd = dc.overloadedFunVd!;
    const paramLabel = olFunVd._$parameterTypes[dc.overloadedIndex!].map(value => value.label).join(', ');
    const retLabel = olFunVd._$returnType[dc.overloadedIndex!].label;
    result = `${pathName}(${paramLabel}):${retLabel}`;
  }
  return result;
}

function buildCompletionItemKindFromValueDescription(vd:ValueDescription): languages.CompletionItemKind{
  switch (vd._$type) {
    case DescriptionType.OverloadedFunctionValue:
    case DescriptionType.FunctionValue:
      return AzLogicAppExpressionLangMonacoEditor.monaco.languages.CompletionItemKind.Function;
    case DescriptionType.ReferenceValue:
      return AzLogicAppExpressionLangMonacoEditor.monaco.languages.CompletionItemKind.Variable;
    case DescriptionType.PackageReference:
      return AzLogicAppExpressionLangMonacoEditor.monaco.languages.CompletionItemKind.Reference;
  }
  return AzLogicAppExpressionLangMonacoEditor.monaco.languages.CompletionItemKind.User;
}

function buildCompletionItemFromDescriptorCollectionEntry(
  contentRange:Range,
  dciPaths: string[],
  dci:DescriptorCollectionItem,
  option:Partial<{
    endWithComma: boolean
  }> = {}
){
  const paramComma = option?.endWithComma ? ', ' : '';

  if (dci.type === 'emptyParaFunctionReturn'){
    const funVd = dci.funVd
    const returnVd = dci.returnVd
    // const funVdDesc = vdCi.funVd?._$desc!
    // const isOlFun = typeof vdCi.overloadedFunParaIndex === 'number';
    const pathsStr = `${dciPaths.join('.')}().${dci.returnPath!.join('.')}`;
    return {
      label: pathsStr,
      kind: buildCompletionItemKindFromValueDescription(dci.funVd!),
      insertText: `${pathsStr}${paramComma}`,
      detail: returnVd?._$desc[0],
      documentation: [...returnVd?._$desc||[], ...funVd?._$desc||[]].join('\n'),
      range: contentRange
    };
  }else if (
    dci.type === "overloadedFunction" ||
    (
      dci.type === "basic" &&
      dci.vd?._$type === DescriptionType.FunctionValue
    )
  ){
    const paths = dciPaths.join('.');
    const innerParaCommas = new Array(getFunctionParaCntFromDc(dci)).fill('').join(', ');
    return {
      label: buildFunctionLabelWithPara(dciPaths, dci),
      kind: AzLogicAppExpressionLangMonacoEditor.monaco.languages.CompletionItemKind.Function,
      insertText: `${paths}(${innerParaCommas})${paramComma}`,
      range: contentRange
    }
  }else{
    // primitive basic
    const label = dciPaths.join('.');
    const vd = dci.vd!;
    return {
      label,
      kind: buildCompletionItemKindFromValueDescription(vd),
      insertText:
        vd._$type=== DescriptionType.FunctionValue ?
          `${label}()${paramComma}`:
          `${label}${paramComma}`,
      range: contentRange
    }
  }
}

function generateCompletionListByNonCompositeType(
  identifierType:IdentifierType,
  contentRange:Range,
  endWithComma:boolean = false,
): languages.CompletionList | undefined{
  if (identifierType.isComposite) return;
  let allRetTypCandidates: IdentifierType[] = identifierType.returnTypeCandidates;

  let collectionOfParamType:DescriptorCollection[] = [];

  allRetTypCandidates.forEach(value => {
    const oneSetOfColl = globalValueDescriptorDict.get(value);
    collectionOfParamType = oneSetOfColl?
        collectionOfParamType.concat(oneSetOfColl):
        collectionOfParamType;
  })

  if (collectionOfParamType && collectionOfParamType.length){
    // alright we got suggestions
    return {
      suggestions: collectionOfParamType
        .filter(value =>
          // we need not support overloadedFunction completion for primitive fields
          value.valDescCollItem.type === 'basic' ||
          value.valDescCollItem.type === 'emptyParaFunctionReturn'
        )
        .map(value => {
          // if (value.valDescCollItem.type === 'emptyParaFunctionReturn'){}
          // else //basic
          return buildCompletionItemFromDescriptorCollectionEntry(
            contentRange,
            value.paths,
            value.valDescCollItem,
            {
              endWithComma
            }
          );
        })
    };
  }
}

export function generateCompletion(codeDocument:CodeDocument, model: editor.ITextModel, position: Position, context: languages.CompletionContext, token: CancellationToken): languages.CompletionList{

  let completionKind: CompletionType = CompletionType.UNKNOWN;
  // for comma
  let postComma = false;
  // for function call
  let functionCallNode:AzLogicAppNodeType<'function-call'>|undefined = undefined;
  let functionFullName = '';
  // for parentheses
  let isFirstParamBeneathParentheses = false;
  let parentParenthesesFunctionFieldSequence = 0;
  let parentParenthesesFunctionCallNode:AzLogicAppNodeType<'function-call'>|undefined = undefined;
  let parentParenthesesFunctionFullName = '';
  let parentParentheses: AzLogicAppNodeType<'parentheses'> | undefined = undefined;
  let parenthesesDirectChild: AzLogicAppNode | undefined = undefined;
  let previousCommaNode:AzLogicAppNodeType<'comma'>|undefined;
  let currentCommaNode:AzLogicAppNodeType<'comma'>|undefined;
  // for identifiers
  let identifiersHead:AzLogicAppNode|undefined = undefined;
  let identifiersTail:AzLogicAppNode|undefined = undefined;
  let identifiersChain:ReturnChainType[] = [];

  const offset = model.getOffsetAt(position)

  const originalNode =codeDocument.getNodeByOffset(offset) as AzLogicAppNode;

  AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
    console.log("[generateCompletion]", offset, originalNode);

  if (originalNode.$impostureLang?.dataType==='atSymbol'){
    // populate the whole functions list directly
    const startPos = model.getPositionAt(offset);
    const endPos = model.getPositionAt(offset);
    const contentRange = new AzLogicAppExpressionLangMonacoEditor.monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
    // const content = model.getValueInRange(contentRange);
    const allFunctionCollection = globalValueDescriptorDict.get(ValueDescriptionDictionaryFunctionKey)!;
    if (allFunctionCollection.length){
      const result = {
        suggestions: allFunctionCollection.map(value => {
          const paths = value.paths.join('.');
          // const vd = value.valueDescription;
          const paraCommas = new Array(getFunctionParaCntFromDc(value.valDescCollItem)).fill('').join(', ');
          return {
            label: buildFunctionLabelWithPara(value.paths, value.valDescCollItem),
            kind: AzLogicAppExpressionLangMonacoEditor.monaco.languages.CompletionItemKind.Function,
            insertText: `${paths}(${paraCommas})`,
            range: contentRange
          }
        })
      };
      AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
        console.log("[generateCompletion::atSymbol]",
          offset, model.getValueInRange(contentRange), originalNode,
          startPos, endPos,
          result.suggestions
        );
      return result;
    }
  }

  let node = originalNode;

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // switch to semantic nodes

  // comma and prepare for FUNCTION_PARAMETER
  if (node?.$impostureLang?.dataType){

    if(
      node.$impostureLang.dataType === 'punctuation-capture' &&
      offset === node.offset+1 &&
      node.parent?.parent
    ){
      const punctuationElderSibling = findAnElderSibling(node.parent as any);
      if (punctuationElderSibling){
        node = punctuationElderSibling;
        completionKind = CompletionType.PROPERTY
      }
    }

    // parentheses and prepare for the first FUNCTION_PARAMETER of the function
    if(node.$impostureLang?.dataType === 'parentheses'){
      if (offset === node.offset){
        const parenthesesElderSibling = findAnElderSibling(node);
        if (parenthesesElderSibling){
          if (completionKind === CompletionType.UNKNOWN){
            completionKind = CompletionType.FUNCTION_CALL;
            node = parenthesesElderSibling;
          }
        }
      }else {
        // make a parentheses child as working node
        if (node.children?.length){
          let parenthesesChildIndex =0;
          let targetChildNode = node;
          let amongTarget = true;
          while (parenthesesChildIndex<node.children.length){
            let childNode = node.children[parenthesesChildIndex];
            if (childNode.offset > offset){
              break;
            }else{
              if (childNode.offset > targetChildNode.offset){
                const amongChild = offset <= (childNode.offset+(childNode.length || 0));
                if (amongChild && amongTarget) {
                  if (
                    (childNode.offset+(childNode.length || 0)) <=
                      (targetChildNode.offset+(targetChildNode.length || 0))
                  ){
                      targetChildNode = childNode as any;
                  }
                }else if (!amongChild && !amongTarget){
                  if ((childNode.offset+(childNode.length || 0)) >=
                    (targetChildNode.offset+(targetChildNode.length || 0))){
                    targetChildNode = childNode as any;
                  }
                }else if (!amongChild && amongTarget){
                  targetChildNode = childNode as any;
                  amongTarget = false;
                }else if (amongChild && !amongTarget){
                  // this should not be reached anyway unless its grammar got modified and messed up
                  // thus, i put some anyway
                  if (
                    (targetChildNode.offset+(targetChildNode.length || 0)) <=
                    childNode.offset
                  ){
                    targetChildNode = childNode as any;
                    amongTarget = true;
                  }
                }
              }
            }
            parenthesesChildIndex ++
          }
          node = targetChildNode;
        }
      }
    }

    if (node.$impostureLang?.dataType === 'comma') {
      postComma = offset >= node.offset +1
      currentCommaNode = node as any;
      node = findAnElderSibling(node) || node;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // prepare mete data from semantic nodes

    // function call
    switch (node.$impostureLang?.dataType) {
      case "function-call":
      case 'function-call-target':
      case 'object-identifiers-captures':
      case 'punctuation-capture':
      case 'punctuation':
      case 'object-identifiers':
      case 'object-identifiers:wPunctuation':
      {
        functionCallNode = findFunctionCallNodeFromNode(node as any);
        if (functionCallNode){
          functionFullName = getFunctionCallFullname(functionCallNode, codeDocument);
          if (completionKind === CompletionType.UNKNOWN){
            completionKind = CompletionType.FUNCTION_CALL;
          }
        }else {
          // for non-function-call punctuation, it might belong its unfinished identity
          // thus try move node forward to continue
          if (
            node.$impostureLang?.dataType === 'punctuation' ||
            node.$impostureLang?.dataType === 'punctuation-capture'
          ){
            node = findAnElderSibling(
              (node.$impostureLang?.dataType === 'punctuation-capture')?
                node.parent as any:
                node
            ) || node;
          }
        }
        break;
      }
    }

    // identifier
    switch (node.$impostureLang?.dataType) {
      case 'function-call-complete':
      case 'object-identifiers-captures':
      case 'identifiers-capture':
      case 'object-identifiers':
      case 'object-identifiers:wPunctuation':
      case 'identifiers':
      case 'identifiers:wPunctuation':
        const chain = findCompleteIdentifiersChain(node, codeDocument);
        if (chain.chain.length){
          identifiersHead = chain.head;
          identifiersTail = chain.tail;
          identifiersChain = chain.chain;
          if (
            completionKind === CompletionType.UNKNOWN
          ){
            completionKind = CompletionType.PROPERTY;
          }
        }
        break;
    }

    // beneath a pair of parentheses
    const checkParenRes = amongFunctionCall(node);
    if (
      checkParenRes &&
      checkParenRes.parenthesesCheckResult !== ParenthesesElderSiblingType.NOT_FOUND
    ){
      parentParentheses = checkParenRes.head as any;
      parenthesesDirectChild = checkParenRes.directChild || node;

      if (
        checkParenRes.parenthesesCheckResult === ParenthesesElderSiblingType.FUNCTION_CALL ||
        checkParenRes.parenthesesCheckResult === ParenthesesElderSiblingType.BENEATH_A_PAIR_OF_PARENTHESES
      ){
        // find the direct child of the function call

        // decide the parameter sequence, currentCommaNode would be set if comma had already been checked
        parentParenthesesFunctionCallNode = findFunctionCallNodeFromNode(findAnElderSibling(parentParentheses as any) as any);
        if (parentParenthesesFunctionCallNode){
          parentParenthesesFunctionFullName = getFunctionCallFullname(parentParenthesesFunctionCallNode, codeDocument);
        }
        // todo use orginal commas if needed
        let curParamParentIndex  = parentParentheses?.children?.indexOf(parenthesesDirectChild);

        // in case we were pushed forward from a comma
        const paramParentIndexOfCurrentCommaNode = currentCommaNode?parentParentheses?.children?.indexOf(currentCommaNode):-1;
        if (typeof paramParentIndexOfCurrentCommaNode === 'number' && paramParentIndexOfCurrentCommaNode > -1){
          curParamParentIndex = paramParentIndexOfCurrentCommaNode;
          if (postComma){
            curParamParentIndex++
          }
        }
        parentParenthesesFunctionFieldSequence = 0;
        if (curParamParentIndex === -1){
          isFirstParamBeneathParentheses = true;
        }else if(typeof curParamParentIndex === 'number' && curParamParentIndex > -1){
          const siblings = parentParentheses?.children || [];
          for (let _paraIndex = 0; _paraIndex < siblings.length; _paraIndex++){
            if (siblings[_paraIndex]?.$impostureLang?.dataType === 'comma'){
              if (_paraIndex < curParamParentIndex!){
                previousCommaNode = siblings[_paraIndex] as any;
                parentParenthesesFunctionFieldSequence++;
              }else if (_paraIndex > curParamParentIndex!){
                currentCommaNode = siblings[_paraIndex] as any;
                break;
              }
            }
          }
        }
        if (
          checkParenRes.parenthesesCheckResult === ParenthesesElderSiblingType.FUNCTION_CALL &&
         (
           completionKind === CompletionType.UNKNOWN ||
           (
             typeof paramParentIndexOfCurrentCommaNode === 'number' &&
             paramParentIndexOfCurrentCommaNode > -1 && postComma
           )||
           (
             completionKind === CompletionType.PROPERTY &&
             identifiersChain.length &&
             identifiersChain[0].node.offset <= offset &&
             identifiersChain[0].node.offset+ (identifiersChain[0].node.length || 0) >= offset
           )
         )
        ){
          completionKind = CompletionType.FUNCTION_PARAMETER
        }
      }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // do generate

    // handle supported completion kind
    switch (completionKind) {
      case CompletionType.FUNCTION_CALL:
        if (functionCallNode){
          const startPos = model.getPositionAt(functionCallNode.offset);
          const endPos = model.getPositionAt(functionCallNode.offset+(functionCallNode.length||0));
          const contentRange = new AzLogicAppExpressionLangMonacoEditor.monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
          // const content = model.getValueInRange(contentRange);
          const allFunctionCollection = globalValueDescriptorDict.get(ValueDescriptionDictionaryFunctionKey)!;
          if (allFunctionCollection.length){
            const result = {
              // cannot use buildCompletionItemFromDescriptorCollectionEntry, as we only wanna
              // suggest function names over here
              suggestions: allFunctionCollection.map(value => {
                const paths = value.paths.join('.');
                // const vd = value.valueDescription;
                return {
                  label: buildFunctionLabelWithPara(value.paths, value.valDescCollItem),
                  kind: AzLogicAppExpressionLangMonacoEditor.monaco.languages.CompletionItemKind.Function,
                  insertText: paths,
                  range: contentRange
                }
              })
            };
            AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
              console.log("[generateCompletion::FUNCTION_CALL]",
                offset, model.getValueInRange(contentRange), functionFullName, functionCallNode, node,
                functionCallNode.offset,
                functionCallNode.offset+(functionCallNode.length||0),
                startPos, endPos,
                result.suggestions[0]
              );
            return result;
          }
        }
        break;
      case CompletionType.FUNCTION_PARAMETER:
        if (parentParentheses) {

          let startOffset = isFirstParamBeneathParentheses?
            offset:
            determinePostOffsetOfOneCommaBeneathParentheses(parentParentheses, previousCommaNode);
          let endOffset = isFirstParamBeneathParentheses?
            offset:
            determinePreOffsetOfOneCommaBeneathParentheses(parentParentheses, currentCommaNode);
          if (offset > endOffset){
            endOffset = offset;
          }
          let startPos = model.getPositionAt(startOffset);
          let endPos = model.getPositionAt(endOffset);
          let contentRange = new AzLogicAppExpressionLangMonacoEditor.monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column)
          let content = model.getValueInRange(contentRange);

          if (
            startOffset <= offset &&
            endOffset >= offset &&
            content.match(/\s*/)
          ){
            // all white space content, reset insert pos
            startPos = model.getPositionAt(offset);
            endPos = model.getPositionAt(offset);
            contentRange = new AzLogicAppExpressionLangMonacoEditor.monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
            content = model.getValueInRange(contentRange);
          }

          if (parentParenthesesFunctionFullName){
            const theFunDesc = findAmongGlobalDescription(parentParenthesesFunctionFullName.split('.'));

            if (theFunDesc){
              let paramTypes:IdentifierType[]|undefined = undefined
              if (theFunDesc._$type === DescriptionType.FunctionValue){
                paramTypes = theFunDesc._$parameterTypes;
              }else if(theFunDesc._$type === DescriptionType.OverloadedFunctionValue){
                const paraSeq = determineOverloadFunParamSeq(codeDocument, parentParenthesesFunctionCallNode?.parent as any, theFunDesc);
                paramTypes = theFunDesc._$parameterTypes[paraSeq];
              }

              if (paramTypes){
                // determine the type
                let theParamType: IdentifierType | undefined;
                if (parentParenthesesFunctionFieldSequence < paramTypes.length){
                  theParamType = paramTypes[parentParenthesesFunctionFieldSequence];
                }else {
                  theParamType = paramTypes[paramTypes.length-1].isVarList? paramTypes[paramTypes.length-1]: theParamType;
                }

                if (theParamType){
                  // todo: support FUNCTION, CONSTANT if needed
                  // warning, these might cause a problem once we fully support CONSTANT and FUNCTION id types
                  const result = generateCompletionListByNonCompositeType(
                      theParamType,
                      contentRange,
                      parentParenthesesFunctionFieldSequence === paramTypes.length -1
                  );
                  if (result){
                    AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
                      console.log("[generateCompletion::FUNCTION_PARAMETER]",
                          offset, content, node,
                          startOffset, endOffset,
                          startPos, endPos,
                          result.suggestions
                      );
                    return result;
                  }
                }

              }
            }
          }
        }
        break;
      case CompletionType.PROPERTY:
        if (identifiersChain){
          if (
            identifiersChain.length>0 &&
            originalNode.$impostureLang?.dataType === 'punctuation-capture' &&
            originalNode.offset + 1 === offset &&
            (identifiersChain[identifiersChain.length-1].node.offset + (identifiersChain[identifiersChain.length-1].node.length || 0)) === offset-1
          ){
            // infer the type and suggest completions right after one punctuation

            // const firstChainNode = identifiersChain[0].node;
            // const lastPropertyNode = identifiersChain[identifiersChain.length-1].node;
            const startOffset = offset;
            const endOffset = offset;
            const startPos = model.getPositionAt(startOffset);
            const endPos = model.getPositionAt(endOffset);
            const contentRange = new AzLogicAppExpressionLangMonacoEditor.monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column)
            const content = model.getValueInRange(contentRange);
            let theReturnValueDescCollection:DescriptorCollection[] = [];

            const curRetVd = findValueDescriptionFromChain(codeDocument, identifiersChain);
            if (curRetVd){
              theReturnValueDescCollection = findAllPathAmongOneDescriptor(
                curRetVd,
                []
              );
            }
            if (theReturnValueDescCollection.length){
              const result = {
                suggestions: theReturnValueDescCollection.map(value => {
                  return buildCompletionItemFromDescriptorCollectionEntry(
                    contentRange,
                    value.paths,
                    value.valDescCollItem,
                  );
                })
              };
              AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
                console.log("[generateCompletion::PROPERTY] post punctuation",
                  offset, content, identifiersChain,
                  startOffset, endOffset,
                  startPos, endPos,
                  result.suggestions
                );
              return result;
            }

          }else if (
            identifiersChain.length >1
          ){
            // infer the whole chain and suggest completions from the second node of the chain

            // todo multiple properties, find all path beneath the package
            const firstChainNode = identifiersChain[0];
            const firstChainNodeContent = codeDocument.getNodeContent(firstChainNode.node);
            const secondPropertyNode = identifiersChain[1].node;
            const lastPropertyNode = identifiersChain[identifiersChain.length-1].node;
            const startOffset = secondPropertyNode.offset;
            const endOffset = lastPropertyNode.offset + (lastPropertyNode.length || 0);
            const startPos = model.getPositionAt(startOffset);
            const endPos = model.getPositionAt(endOffset);
            const contentRange = new AzLogicAppExpressionLangMonacoEditor.monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column)
            const content = model.getValueInRange(contentRange);
            let theReturnValueDescCollection:DescriptorCollection[] = [];
            let theReturnValueDescCollectionPathSliceStartIndex = 1;

            if(firstChainNode.type === 'function-call-complete'){
              // alright, if the first node were of function call type,
              // we gonna infer from function call return type
              const functionFullName = firstChainNode.functionFullName;
              const theFunDesc = findAmongGlobalDescription(functionFullName.split('.'));
              if (theFunDesc){
                const funRetTyp = determineReturnIdentifierTypeOfFunction(
                  codeDocument,
                  firstChainNode as any,
                  theFunDesc
                );

                if (
                  funRetTyp && funRetTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE &&
                  funRetTyp.returnTypeChainList?.length
                ){
                  theReturnValueDescCollectionPathSliceStartIndex = funRetTyp.returnTypeChainList.length;
                  theReturnValueDescCollection = findAllPathAmongGlobal([
                    ...funRetTyp.returnTypeChainList,
                    ...(identifiersChain.slice(1) as (IdentifierInBracketNotationReturnChainType|IdentifierReturnChainType)[])
                      .map(value => value.identifierName)
                  ]);
                }
              }
            }else if (
              'identifierName' in firstChainNode &&
              firstChainNode.identifierName
            ){
              // or it's just a regular package reference
              theReturnValueDescCollection = findAllPathAmongGlobal(
                (identifiersChain as (IdentifierInBracketNotationReturnChainType|IdentifierReturnChainType)[])
                  .map(value => value.identifierName)
              )
            }

            if (theReturnValueDescCollection.length){
              const result = {
                suggestions: theReturnValueDescCollection.map(value => {
                  return buildCompletionItemFromDescriptorCollectionEntry(
                    contentRange,
                    [
                      firstChainNodeContent,
                      ...value.paths.slice(theReturnValueDescCollectionPathSliceStartIndex)
                    ],
                    value.valDescCollItem
                  );
                })
              };
              AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
                console.log("[generateCompletion::PROPERTY] multiple",
                  offset, content, secondPropertyNode, lastPropertyNode, identifiersChain,
                  startOffset, endOffset,
                  startPos, endPos,
                  result.suggestions
                );
              return result;
            }
          }else{
            // the identifiersChain is of the size 1 and we gonna suggest all root packages
            const thePropertyNode = identifiersChain[0].node;
            const startOffset = thePropertyNode.offset;
            const endOffset = thePropertyNode.offset + (thePropertyNode.length || 0);
            const startPos = model.getPositionAt(startOffset);
            const endPos = model.getPositionAt(endOffset);
            const contentRange = new AzLogicAppExpressionLangMonacoEditor.monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column)
            const content = model.getValueInRange(contentRange);
            const allRootPackages = findAllRootPackageOfOneDescriptor();
            const result = {
              suggestions: allRootPackages
                .filter(value => value.valDescCollItem.type !== 'emptyParaFunctionReturn')
                .map(value => {
                  return buildCompletionItemFromDescriptorCollectionEntry(
                    contentRange,
                    value.paths,
                    value.valDescCollItem
                  );
                })
            };
            AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
              console.log("[generateCompletion::PROPERTY] root one",
                offset, content, identifiersChain[0],
                startOffset, endOffset,
                startPos, endPos,
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
    suggestions:[]
  }
}
