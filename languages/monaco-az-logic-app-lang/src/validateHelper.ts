import {CodeDocument, Position} from '@monaco-imposture-tools/core';
import {AzLogicAppNode, AzLogicAppLangConstants} from './base';

export enum ErrorCode {
  INVALID_AT_SYMBOL = 0x001,
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
  INVALID_ROOT_FUNCTION_CALL,
  INVALID_STANDALONE_ACCESSOR,
  UNRECOGNIZED_TOKENS,
  INCORRECT_ITEM_SIZE_OF_BRACKET_NOTATION_IDENTIFIER,
  INCORRECT_FIRST_ITEM_TYPE_OF_BRACKET_NOTATION_IDENTIFIER,
  // todo add a new one, no qstring-dbl in expression
}

export enum DiagnosticSeverity {
  Hint = 1,
  Information = 2,
  Warning = 4,
  Error = 8,
}

export interface Problem {
  severity: DiagnosticSeverity;
  code: ErrorCode;
  message: string;
  startPos: Position;
  endPos: Position;
  node: AzLogicAppNode;
  data?: any;
}

export class ValidateResult {
  public problems: Problem[] = [];

  constructor(
    public readonly codeDocument: CodeDocument,
    public readonly globalSymbolTable = AzLogicAppLangConstants.globalSymbolTable
  ) {}

  public hasProblems(): boolean {
    return !!this.problems.length;
  }
}

export enum WrapperType {
  ROOT = 0x001,
  ROOT_FUNCTION_CALL = 0x001,
  FUNCTION_PARENTHESES,
  PARENTHESES,
  CURLY_BRACKETS,
  LITERAL_ARRAY,
}

export interface ValidationIntermediateContext {
  vr: ValidateResult;
  directWrapperType: WrapperType;
  needOneSeparator?: boolean;
  hasFunctionCall?: boolean;
  precedingPeerIdentifierExist?: boolean;
  precedingPeerTemplateExist?: boolean;
  skipIndices?: number;
}
