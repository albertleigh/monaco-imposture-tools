import {CodeDocument, Position} from "@monaco-imposture-tools/core";
import {AzLogicAppNode, AzLogicAppNodeType, DescriptionType, IdentifierType} from "./base";
import {
  determineOverloadFunParamSeq, findAnElderSibling,
  findAYoungerSibling,
  findCompleteForwardIdentifiersChain,
  getFunctionCallFullname,
  inferIdentifierTypeFromChain,
  listCommaIndicesOfParenthesesChildren,
  populateVarParaIncreasingly
} from "./utils";
import {findAmongGlobalDescription, findValueDescriptionFromChain} from "./values";

export enum ErrorCode{
  INVALID_AT_SYMBOL                               = 0x001,
  NEED_PRECEDING_SEPARATOR,
  INVALID_FUNCTION_PATTERN,
  UNKNOWN_FUNCTION_NAME,
  FUNCTION_PARAMETER_COUNT_MISMATCHES,
  FUNCTION_PARAMETER_TYPE_MISMATCHES,
  INVALID_IDENTIFIER,
  INVALID_IDENTIFIER_CHAIN,
  INVALID_FUNCTION_IDENTIFIER_CHAIN,
  INVALID_MULTIPLE_EXPRESSION,
  INVALID_TEMPLATE,
  INVALID_NESTED_TEMPLATE,
}

export enum DiagnosticSeverity{
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export interface Problem{
  severity: DiagnosticSeverity;
  code:ErrorCode,
  message:string,
  startPos:Position
  endPos:Position
  node:AzLogicAppNode,
  data?:any
}

export class ValidateResult{
  public problems:Problem[]=[];


  constructor(
    public readonly codeDocument:CodeDocument
  ) {

  }

  public hasProblems(): boolean {
    return !!this.problems.length;
  }
}

enum WrapperType{
  ROOT                                    = 0x001,
  FUNCTION_PARENTHESES,
  PARENTHESES,
  CURLY_BRACKETS,
}

interface ValidationIntermediateContext{
  vr: ValidateResult,
  directWrapperType:WrapperType,
  needOneSeparator?:boolean,
  hasFunctionCall?:boolean,
  precedingPeerIdentifierExist?:boolean,
  precedingPeerTemplateExist?:boolean,
  skipIndices?:number
}

function _validate_at_symbol(node:AzLogicAppNode, ctx:ValidationIntermediateContext){
  const returnCtx = {...ctx};
  if (node.$impostureLang?.dataType === 'atSymbol'){
    const nextNode = findAYoungerSibling(node);
    if (nextNode){
      switch (nextNode.$impostureLang?.dataType) {
        case "function-call-complete":
        case "identifiers":
        case "object-identifiers":
        case "atTemplateSubstitutionElement":
          break;
        // case "atSymbol":
        //   returnCtx.skipIndices = 1;
        //   break;
        default:
          ctx.vr.problems.push({
            severity: DiagnosticSeverity.Error,
            code: ErrorCode.INVALID_AT_SYMBOL,
            message: `Invalid symbol @`,
            startPos: ctx.vr.codeDocument.positionAt(node.offset),
            endPos: ctx.vr.codeDocument.positionAt(node.offset+ (node.length || 0)),
            node
          });
          break;
      }
    }
  }
  return returnCtx;
}

function _validate_at_template_sub_element(node:AzLogicAppNode, ctx:ValidationIntermediateContext){
  const returnCtx = {...ctx};
  if (node.$impostureLang?.dataType === "atTemplateSubstitutionElement"){
    // check valid template or not: check a preceding symbol @ existed or not
    const theElderSibling = findAnElderSibling(node);
    if (
      !theElderSibling ||
      theElderSibling.$impostureLang?.dataType !== "atSymbol"
    ){
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.INVALID_TEMPLATE,
        message: `Miss a preceding @ for a template`,
        startPos: ctx.vr.codeDocument.positionAt(node.offset),
        endPos: ctx.vr.codeDocument.positionAt(node.offset+ (node.length || 0)),
        node
      });
      return returnCtx;
    }

    Object.assign(returnCtx, _validate_children(node, {...ctx, directWrapperType:WrapperType.CURLY_BRACKETS}));
  }
  return returnCtx;
}

function _validate_function_call_complete(node:AzLogicAppNode, ctx:ValidationIntermediateContext){
  const returnCtx = {...ctx, hasFunctionCall:true};

  if (
    node?.$impostureLang?.dataType === 'function-call-complete'
  ){
    if (ctx.directWrapperType === WrapperType.ROOT){
      const theElderSibling = findAnElderSibling(node);
      //check valid root fun-call-complete or not
      if (
        !theElderSibling ||
        theElderSibling.$impostureLang?.dataType !== "atSymbol"
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_FUNCTION_PATTERN,
          message: `Miss a preceding @ for the function call at root statement`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset+ (node.length || 0)),
          node
        });
        return returnCtx;
      }
    }

    // check the content of the fun-call-complete
    if (
      node.children?.length === 2 &&
      node.children[0]?.$impostureLang?.dataType === 'function-call' &&
      node.children[1]?.$impostureLang?.dataType === 'parentheses'
    ){

      const functionCallNode = node.children[0] as AzLogicAppNodeType<'function-call'>;
      const parenthesesNode = node.children[1] as AzLogicAppNodeType<'parentheses'>;
      const functionCallFullName = getFunctionCallFullname(functionCallNode, ctx.vr.codeDocument);
      const functionCallPaths = functionCallFullName.split('.');
      const functionDesc = findAmongGlobalDescription(functionCallPaths);
      // check function name exist or not
      if (
        !functionDesc ||
        (
          functionDesc._$type !== DescriptionType.FunctionValue &&
          functionDesc._$type !== DescriptionType.OverloadedFunctionValue
        )
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.UNKNOWN_FUNCTION_NAME,
          message: `Unknown function name`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset+ (node.length || 0)),
          node
        });
      }else{

        // validate parentheses children first
        Object.assign(returnCtx, _validate_children(parenthesesNode, {...ctx, directWrapperType: WrapperType.FUNCTION_PARENTHESES}));

        // first ensure we gotta no problems beneath our parameter children
        // then check parameter types
        if (!ctx.vr.hasProblems()){

          let parameterTypes:IdentifierType[] | undefined = undefined;
          // determine the param list
          if (functionDesc._$type === DescriptionType.OverloadedFunctionValue){
            const paraSeq = determineOverloadFunParamSeq(ctx.vr.codeDocument, node, functionDesc);
            parameterTypes = functionDesc._$parameterTypes[paraSeq].slice();
          }else{
            // regular function
            parameterTypes = functionDesc._$parameterTypes.slice();
          }

          // parameterTypes should be defined and of array type or there might be severer grammar flaws
          if (Array.isArray(parameterTypes)){
            // check function parameter cnt matches or not
            const curParenthesesChildrenCnt = parenthesesNode.children?.length || 0;
            const paramCnt = parameterTypes.length;
            let commaIndices = listCommaIndicesOfParenthesesChildren(parenthesesNode.children as AzLogicAppNode[]|undefined);
            if (
              (curParenthesesChildrenCnt !== 0 || paramCnt!==0) &&
              (
                !parameterTypes.some(onePara => onePara.isVarList) &&
                (
                  (commaIndices.length +1 !== paramCnt) ||
                  (curParenthesesChildrenCnt < paramCnt*2 - 1)
                )
              )
            ){
              ctx.vr.problems.push({
                severity: DiagnosticSeverity.Error,
                code: ErrorCode.FUNCTION_PARAMETER_COUNT_MISMATCHES,
                message: `The function call lacked or had more parameters required`,
                startPos: ctx.vr.codeDocument.positionAt(node.offset),
                endPos: ctx.vr.codeDocument.positionAt(node.offset+ (node.length || 0)),
                node
              });
            }else{
              if (
                paramCnt &&
                parenthesesNode.children
              ){
                commaIndices.unshift(0);
                commaIndices.push(parenthesesNode.children.length-1);
                // iterate, seize and validate param return type
                let paraIndex =0;
                while (paraIndex < commaIndices.length -1){
                  let match = false;
                  let mismatchSrcTyp: IdentifierType | undefined;
                  let mismatchTargetTyp: IdentifierType | undefined;
                  const oneParaNode =
                    paraIndex === 0 ?
                      parenthesesNode.children[commaIndices[paraIndex]]:
                      findAYoungerSibling(parenthesesNode.children[commaIndices[paraIndex]] as any)
                  if (oneParaNode){
                    // infer idChain return type
                    const oneIdChain = findCompleteForwardIdentifiersChain(
                      oneParaNode as any,
                      ctx.vr.codeDocument
                    )
                    const sourceIdTyp = inferIdentifierTypeFromChain(ctx.vr.codeDocument, oneIdChain.chain);
                    const targetIdType = parameterTypes[paraIndex];
                    if (targetIdType.isVarList){
                      populateVarParaIncreasingly(parameterTypes, paraIndex)
                    }
                    // check it match or not
                    match = !!(sourceIdTyp?.assignableTo(targetIdType));
                    if (!match){
                      mismatchSrcTyp = sourceIdTyp;
                      mismatchTargetTyp = targetIdType;
                    }
                  }
                  if (!match){
                    ctx.vr.problems.push({
                      severity: DiagnosticSeverity.Error,
                      code: ErrorCode.FUNCTION_PARAMETER_TYPE_MISMATCHES,
                      message: `Cannot fit ${mismatchSrcTyp? mismatchSrcTyp.label : 'empty'} into the function parameter ${mismatchTargetTyp? mismatchTargetTyp.label : 'empty'}.`,
                      startPos: ctx.vr.codeDocument.positionAt(
                        parenthesesNode.children[commaIndices[paraIndex]].offset
                      ),
                      endPos: ctx.vr.codeDocument.positionAt(
                        paraIndex+1 === paramCnt?
                          parenthesesNode.offset +
                          (parenthesesNode.length || 0):
                          parenthesesNode.children[commaIndices[paraIndex+1]].offset
                      ),
                      node
                    });
                    break;
                  }
                  paraIndex++;
                }
              }

            }
          }
        }
        // and ensure we gotta no problems in the function call body
        // then check its appended identifier chain
        if (!ctx.vr.hasProblems()){
          const postFunCallChain = findCompleteForwardIdentifiersChain(node, ctx.vr.codeDocument);
          if (postFunCallChain.chain.length > 1){
            // alright we did have a chain longer than one, and need to validate it
            const chainVd = findValueDescriptionFromChain(ctx.vr.codeDocument, postFunCallChain.chain);
            if (!chainVd){
              ctx.vr.problems.push({
                severity: DiagnosticSeverity.Error,
                code: ErrorCode.INVALID_FUNCTION_IDENTIFIER_CHAIN,
                message: `Unrecognized identifiers of the function result`,
                startPos: ctx.vr.codeDocument.positionAt(postFunCallChain.head.offset + (postFunCallChain.head.length || 0)),
                endPos: ctx.vr.codeDocument.positionAt(postFunCallChain.tail.offset + (postFunCallChain.tail.length || 0)),
                node
              })
            }
          }
        }
      }
    }else{
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.INVALID_FUNCTION_PATTERN,
        message: `Invalid function pattern`,
        startPos: ctx.vr.codeDocument.positionAt(node.offset),
        endPos: ctx.vr.codeDocument.positionAt(node.offset+ (node.length || 0)),
        node
      });
    }
  }
  return returnCtx;
}

function _validate_identifiers(node:AzLogicAppNode, ctx:ValidationIntermediateContext){
  const returnCtx = {...ctx};
  const postChain = findCompleteForwardIdentifiersChain(node, ctx.vr.codeDocument);
  if (postChain.chain.length){
    returnCtx.skipIndices = postChain.chain.length;
    const chainVd = findValueDescriptionFromChain(ctx.vr.codeDocument, postChain.chain);
    if (!chainVd){
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.INVALID_IDENTIFIER_CHAIN,
        message: `Unrecognized identifiers`,
        startPos: ctx.vr.codeDocument.positionAt(postChain.head.offset),
        endPos: ctx.vr.codeDocument.positionAt(postChain.tail.offset + (postChain.tail.length || 0)),
        node
      })
    }else if(
      chainVd._$type === DescriptionType.OverloadedFunctionValue ||
      chainVd._$type === DescriptionType.FunctionValue
    ){
      ctx.vr.problems.push({
        severity: DiagnosticSeverity.Error,
        code: ErrorCode.INVALID_IDENTIFIER_CHAIN,
        message: `Missing invocation of the function`,
        startPos: ctx.vr.codeDocument.positionAt(postChain.head.offset),
        endPos: ctx.vr.codeDocument.positionAt(postChain.tail.offset + (postChain.tail.length || 0)),
        node
      })
    }
  }else{
    // unrecognized identifier node
    ctx.vr.problems.push({
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.INVALID_IDENTIFIER,
      message: `Unrecognized identifier`,
      startPos: ctx.vr.codeDocument.positionAt(postChain.head.offset),
      endPos: ctx.vr.codeDocument.positionAt(postChain.tail.offset + (postChain.tail.length || 0)),
      node
    })
  }
  return returnCtx;
}

function _validate_children(node:AzLogicAppNode, ctx:ValidationIntermediateContext):ValidationIntermediateContext{
  let returnCtx = {...ctx};
  let needOneSeparator = false;
  let precedingPeerIdentifierExist = false;
  let precedingPeerTemplateExist = false;
  if (node.children && node.children.length){
    let index = 0;
    while (index< node.children.length){
      const oneVrCtx = _do_validate(
        node.children[index] as AzLogicAppNode,
        {...ctx, needOneSeparator, precedingPeerIdentifierExist, precedingPeerTemplateExist}
      );
      needOneSeparator = !!oneVrCtx.needOneSeparator && ctx.directWrapperType!==WrapperType.CURLY_BRACKETS;
      delete oneVrCtx.needOneSeparator;
      precedingPeerIdentifierExist = precedingPeerIdentifierExist || !!oneVrCtx.precedingPeerIdentifierExist;
      delete oneVrCtx.precedingPeerIdentifierExist;
      precedingPeerTemplateExist = precedingPeerTemplateExist || !!oneVrCtx.precedingPeerTemplateExist;
      delete oneVrCtx.precedingPeerTemplateExist;
      if (oneVrCtx.skipIndices){
        index += oneVrCtx.skipIndices
        delete oneVrCtx.skipIndices;
      }
      Object.assign(returnCtx, oneVrCtx);
      index++;
    }
  }
  return returnCtx;
}

function _do_validate(node:AzLogicAppNode, ctx:ValidationIntermediateContext):ValidationIntermediateContext{
  let returnCtx = {...ctx};

  if (ctx.needOneSeparator && (
    node?.$impostureLang?.dataType === 'function-call-complete' ||
    node?.$impostureLang?.dataType === 'identifiers' ||
    node?.$impostureLang?.dataType === 'object-identifiers' ||
    node?.$impostureLang?.dataType === 'parentheses' ||
    node?.$impostureLang?.dataType === 'number' ||
    node?.$impostureLang?.dataType === 'string' ||
    node?.$impostureLang?.dataType === 'boolean' ||
    node?.$impostureLang?.dataType === 'null'
  )){
    ctx.vr.problems.push({
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.NEED_PRECEDING_SEPARATOR,
      message: `Miss a preceding comma`,
      startPos: ctx.vr.codeDocument.positionAt(node.offset),
      endPos: ctx.vr.codeDocument.positionAt(node.offset+(node.length || 1)),
      node
    });
  }

  switch (node?.$impostureLang?.dataType){
    case 'atSymbol':
      returnCtx = _validate_at_symbol(node, returnCtx);
      break;
    case "atTemplateSubstitutionElement":
      if(
        ctx.directWrapperType === WrapperType.CURLY_BRACKETS
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_NESTED_TEMPLATE,
          message: `A template cannot nest each other`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset+(node.length || 1)),
          node
        });
      }else if (
        ctx.directWrapperType === WrapperType.ROOT &&
        ctx.precedingPeerIdentifierExist
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_TEMPLATE,
          message: `A string template cannot succeed an identifier within the root statement`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset+(node.length || 1)),
          node
        });
      }else{
        returnCtx = _validate_at_template_sub_element(node, returnCtx)
      }
      returnCtx.precedingPeerTemplateExist = true;
      break;
    case "function-call-complete":
      if (
        ctx.directWrapperType === WrapperType.ROOT &&
        ctx.precedingPeerTemplateExist
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_MULTIPLE_EXPRESSION,
          message: `An identifier cannot succeed a template string within the root statement`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset+(node.length || 1)),
          node
        });
      }else if (
        (
          ctx.directWrapperType === WrapperType.ROOT ||
          ctx.directWrapperType === WrapperType.CURLY_BRACKETS
        )&&
        ctx.precedingPeerIdentifierExist
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_MULTIPLE_EXPRESSION,
          message: `Cannot have multiple identifiers within the ${ctx.directWrapperType === WrapperType.ROOT?'root statement':'curly brackets'}`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset+(node.length || 1)),
          node
        });
      }else{
        returnCtx = _validate_function_call_complete(node, returnCtx)
      }
      returnCtx.needOneSeparator= true;
      returnCtx.precedingPeerIdentifierExist= true;
      break;
    case 'identifiers':
    case 'object-identifiers':
      if (
        (
          ctx.directWrapperType === WrapperType.ROOT ||
          ctx.directWrapperType === WrapperType.CURLY_BRACKETS
        )&&
        ctx.precedingPeerIdentifierExist
      ){
        ctx.vr.problems.push({
          severity: DiagnosticSeverity.Error,
          code: ErrorCode.INVALID_MULTIPLE_EXPRESSION,
          message: `Cannot have multiple identifiers within the ${ctx.directWrapperType === WrapperType.ROOT?'root statement':'curly brackets'}`,
          startPos: ctx.vr.codeDocument.positionAt(node.offset),
          endPos: ctx.vr.codeDocument.positionAt(node.offset+(node.length || 1)),
          node
        });
      }else{
        returnCtx = _validate_identifiers(node, returnCtx)
      }
      returnCtx.needOneSeparator= true;
      returnCtx.precedingPeerIdentifierExist= true;
      break;
    case 'parentheses':
    case 'number':
    case 'string':
    case 'boolean':
    case 'null':
      returnCtx.needOneSeparator= true;
      returnCtx.precedingPeerIdentifierExist= true;
      break;
    case 'comma':
      returnCtx.needOneSeparator= false;
      break;
    default:
      Object.assign(returnCtx, _validate_children(node, ctx));
      break;
  }
  return returnCtx
}

export function validateCodeDocument(codeDocument:CodeDocument):ValidateResult{
  const vr = new ValidateResult(codeDocument);
  const node = codeDocument.root;
  if (node?.type === 'IncludeOnlyRule'){
    _validate_children(node as any, {vr, directWrapperType: WrapperType.ROOT});
  }
  return vr;
}
