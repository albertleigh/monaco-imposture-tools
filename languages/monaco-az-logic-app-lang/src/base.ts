import {ASTNode, IGrammar, IRawTheme, Registry} from '@monaco-imposture-tools/core';
import {default as monaco} from './editor.api';
import {themes} from "./themes";

export const SYMBOL_TABLE_FUNCTION_RETURN_PATH_NAME = '_$functionReturnType';

export type DataType =
  | 'dualAtSymbol'
  | 'atSymbol'
  | 'atTemplateSubstitutionElement'
  | 'incomplete-root-function-call-expression'
  | 'root-function-call-expression'
  | 'parentheses'
  | 'comma'
  | 'function-call-complete'
  | 'function-call'
  | 'function-call-target'
  | 'identifiers'
  | 'identifiers:wPunctuation'
  | 'identifiers-capture'
  | 'object-identifiers'
  | 'object-identifiers:wPunctuation'
  | 'object-identifiers-captures'
  | 'punctuation'
  | 'punctuation-capture'
  | 'array-literal'
  | 'number'
  | 'string'
  | 'boolean'
  | 'null';

interface $impostureLangType<T = DataType> {
  type?: string;
  dataType?: T;
  namespaces: string[];
}

export type AzLogicAppNodeType<T extends DataType> = AzLogicAppNode & {
  $impostureLang?: $impostureLangType<T>;
};

export type AzLogicAppNode = ASTNode & {
  $impostureLang?: $impostureLangType<any>;
};



export type TraceHandler = (message: string, properties?: { [key: string]: any })=> void;
export type ErrorHandler = (namespace:string, err:Error)=> void;

export class AzLogicAppLangConstants{

  static readonly SCOPE_NAME = 'source.azLgcAppExp'; // source.js      ->    source.azLgcAppExp
  static readonly LANGUAGE_ID = 'azureLogicAppExpression'; // javascript     ->    azureLogicAppExpression
  static readonly DEFAULT_EDITOR_ID = 'az-lg-app-exp-default-editor';

  static inLexicalDebugMode = false;
  static inSyntaxDebugMode = false;
  static inSemanticDebugMode = false;
  static globalTraceHandler?: TraceHandler;
  static globalErrorHandler?: ErrorHandler;

  static _init: Promise<any> | undefined = undefined;
  static _registry: Registry | undefined = undefined;

  static _grammar: IGrammar | null | undefined = undefined;
  static _theme: IRawTheme = themes['default'];
  static _usingBuiltInTheme = true;

  static _monaco: typeof monaco | undefined;

  private constructor() {
  }
}
