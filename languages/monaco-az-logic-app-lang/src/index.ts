import {SymbolTable, createSymbolTable} from './values'
import {AzLogicAppExpressionLangMonacoEditor} from './editors';

export * from '@monaco-imposture-tools/core';
export {
  ErrorHandler,
} from './base';
export {
  ValueDescription,
  FunctionValueDescription,
  OverloadedFunctionValueDescription,
  ReferenceValueDescription,
  PackageDescription,
  IdentifierType,
  SymbolTable,
  createFunValDesc,
  createOverloadedFunValDesc,
  createRefValDesc,
  createPkgValDesc,
  createSymbolTable,
  createFunRetDesc,
} from './values';

export {Problem, ValidateResult} from './validateHelper';
export {AzLogicAppExpressionLangMonacoEditor} from './editors';
export {AzLgcExpDocument} from './parser';


SymbolTable.globalSymbolTable = createSymbolTable({});
SymbolTable.globalValueDescriptionDict
  = SymbolTable.globalSymbolTable.generateValueDescriptionDictionary();

export const emtpyFunRetTyp = SymbolTable.emtpyFunRetTyp;
export const globalSymbolTableBase =  SymbolTable.globalSymbolTableBase;
export const globalSymbolTable = SymbolTable.globalSymbolTable;


export default AzLogicAppExpressionLangMonacoEditor;
