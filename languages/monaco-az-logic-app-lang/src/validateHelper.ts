import {CodeDocument, Position} from '@monaco-imposture-tools/core';
import {AzLogicAppNode} from './base';
import {SymbolTable} from './values';

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
  IDENTIFIER_ACCESSOR_MUST_BE_OPTIONAL,
  Q_STRING_DOUBLE_IS_NOT_ALLOWED,

  // warnings 0x200
  MISMATCHED_CASES_FOUND = 0X201,

  // infos 0x400

  // hints
  IDENTIFIER_ACCESSOR_NEED_NOT_BE_OPTIONAL = 0x801,
  INCOMPLETE_ROOT_FUNCTION_CALL_STRING,
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
  source?: any;
  data?: any;
}

export class ValidateResult {
  private _problems: Problem[] = [];

  get problems(){
    return this._problems.slice();
  }

  constructor(
    public readonly codeDocument: CodeDocument,
    public readonly globalSymbolTable = SymbolTable.globalSymbolTable
  ) {}

  get errors(){
    return this._problems.filter(one=>one.code < 0x200);
  }

  public hasProblems(): boolean {
    return !!this.errors.length
  }

  public addOneProblem(problem:Problem, ctx:ValidationIntermediateContext){

    //beneathIncompleteRootFunctionCall
    if (!!ctx.beneathIncompleteRootFunctionCall){
      if (problem.severity !== DiagnosticSeverity.Error){
        this._problems.push(problem);
      }
      return;
    }

    //regular
    this._problems.push(problem);

  }

}

export enum WrapperType {
  ROOT = 0x001,
  ROOT_FUNCTION_CALL = 0x101,
  FUNCTION_PARENTHESES,
  PARENTHESES,
  CURLY_BRACKETS,
  LITERAL_ARRAY,
}

// todo make this a class latter
export interface ValidationIntermediateContext {
  vr: ValidateResult;
  directWrapperType: WrapperType;
  needOneSeparator?: boolean;
  beneathIncompleteRootFunctionCall?: boolean;
  hasFunctionCall?: boolean;
  precedingPeerIdentifierExist?: boolean;
  precedingPeerTemplateExist?: boolean;
  skipIndices?: number;
}
