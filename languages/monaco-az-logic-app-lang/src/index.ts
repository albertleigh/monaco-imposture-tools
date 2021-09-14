import {AzLogicAppLangConstants} from './base'
import {AzLogicAppExpressionLangMonacoEditor} from './editors';
import {
  createSymbolTable,
  generateValueDescriptionDictionary
} from './utils'

export * from '@monaco-imposture-tools/core';
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
  createFunRetDesc,
} from './base';

export {
  createSymbolTable
} from './utils';

export {Problem, ValidateResult} from './validateHelper';
export {AzLogicAppExpressionLangMonacoEditor} from './editors';
export {AzLgcExpDocument} from './parser';


AzLogicAppLangConstants.globalSymbolTable = createSymbolTable({});
//
AzLogicAppLangConstants.globalValueDescriptionDict = generateValueDescriptionDictionary(AzLogicAppLangConstants.globalSymbolTable);

export const emtpyFunRetTyp = AzLogicAppLangConstants.emtpyFunRetTyp;
export const globalSymbolTableBase =  AzLogicAppLangConstants.globalSymbolTableBase;
export const globalSymbolTable = AzLogicAppLangConstants.globalSymbolTable;


export default AzLogicAppExpressionLangMonacoEditor;
