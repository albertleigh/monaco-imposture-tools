import {Registry, ValueEventEmitter} from '@monaco-imposture-tools/core';
import {initOnigasm} from '@monaco-imposture-tools/oniguruma-asm';
import {ValidateResult} from './validateHelper';
import {AzLgcExpDocument, parseAzLgcExpDocument} from "./parser";
import {AzLogicAppLangConstants, ErrorHandler, TraceHandler} from "./base";
import {SymbolTable, ValueDescriptionDictionary, PackageDescription} from './values';


export class AzLogicAppExpressionLanguage {

  public static get inLexicalDebugMode(){
    return AzLogicAppLangConstants.inLexicalDebugMode;
  }
  public static set inLexicalDebugMode(val:boolean){
    AzLogicAppLangConstants.inLexicalDebugMode = val;
  }

  public static get inSyntaxDebugMode(){
    return AzLogicAppLangConstants.inSyntaxDebugMode;
  }
  public static set inSyntaxDebugMode(val:boolean){
    AzLogicAppLangConstants.inSyntaxDebugMode = val;
  }

  public static get inSemanticDebugMode(){
    return AzLogicAppLangConstants.inSemanticDebugMode;
  }
  public static set inSemanticDebugMode(val:boolean){
    AzLogicAppLangConstants.inSemanticDebugMode = val;
  }

  public static get globalTraceHandler(){
    return AzLogicAppLangConstants.globalTraceHandler;
  }
  public static set globalTraceHandler(handler:TraceHandler|undefined){
    AzLogicAppLangConstants.globalTraceHandler = handler;
  }

  public static get globalErrorHandler(){
    return AzLogicAppLangConstants.globalErrorHandler;
  }
  public static set globalErrorHandler(handler:ErrorHandler|undefined){
    AzLogicAppLangConstants.globalErrorHandler = handler;
  }

  public static set caseMode(mode:typeof PackageDescription.CASE_MODE){
    PackageDescription.CASE_MODE=mode;
  }

  public static get init() {
    return AzLogicAppLangConstants._init;
  }
  public static get grammar() {
    return AzLogicAppLangConstants._grammar;
  }

  private static _scannerOrItsPath: string | ArrayBuffer;
  static set scannerOrItsPath(scannerOrItsPath: string | ArrayBuffer) {
    this._scannerOrItsPath = scannerOrItsPath;
  }

  private static _grammarContent:
    | Promise<string | object>
    | string
    | object = require('../grammar/LogicApps.tmLanguage.json');
  static set grammarContent(grammarContent: Promise<string | object> | string | object) {
    this._grammarContent = grammarContent;
  }

  public static manuallyParseSync(
    symbolTable: SymbolTable,
    text: string,
  ){
    let azLgcExpDoc: AzLgcExpDocument | undefined = undefined;
    try{
      const codeDoc = this.grammar!.parse(text);
      azLgcExpDoc = parseAzLgcExpDocument(codeDoc, symbolTable);
      AzLogicAppExpressionLanguage.inSyntaxDebugMode &&
      console.log("[azLgcLang::manuallySyncParse]", azLgcExpDoc?.entries, azLgcExpDoc?.validateResult, azLgcExpDoc);
      AzLogicAppExpressionLanguage.inSyntaxDebugMode &&
      azLgcExpDoc?.consoleLogSyntaxNodes();
      if (this.globalTraceHandler){
        this.globalTraceHandler('[AzLogicAppExpressionLanguage::manuallySyncParse] succeed')
      }
    }catch (error) {
      if (this.globalErrorHandler){
        this.globalErrorHandler('[AzLogicAppExpressionLanguage::manuallySyncParse] error', error)
      }else {
        throw error;
      }
    }
    return azLgcExpDoc;
  }

  public static activate(
    grammarContent: Promise<string | object> | string | object = this._grammarContent
  ):Promise<any> {
    if (this.init) return this.init;

    this._grammarContent = grammarContent;

    if (
      (!(grammarContent instanceof Promise) &&
        typeof grammarContent !== 'string' &&
        typeof grammarContent !== 'object'
      )
    ) {
      throw Error(
        `Failed to activate Az logic app exp language: Invalid scannerOrItsPath, grammarContent or monaco language module`
      );
    }

    AzLogicAppLangConstants._init = (async () => {
      await initOnigasm();
      AzLogicAppLangConstants._registry = new Registry({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        debug: AzLogicAppExpressionLanguage.inLexicalDebugMode,
        theme: AzLogicAppLangConstants._theme,
        getGrammarDefinition: async (scopeName) => {
          if (scopeName === AzLogicAppLangConstants.SCOPE_NAME){
            return {
              format: 'json',
              content: grammarContent instanceof Promise ? await grammarContent : grammarContent,
            };
          }else{
            throw new Error(`Unsupported grammar request of scope name ${scopeName}`);
          }
        },
      });

      const grammar = await AzLogicAppLangConstants._registry.loadGrammar(AzLogicAppLangConstants.SCOPE_NAME, 0);
      AzLogicAppLangConstants._grammar = grammar;


      AzLogicAppExpressionLanguage.inSemanticDebugMode &&
      console.log('[AzLogicAppExpressionLanguage init]');
      if (AzLogicAppExpressionLanguage.globalTraceHandler){
        AzLogicAppExpressionLanguage.globalTraceHandler('[AzLogicAppExpressionLanguage::init] succeed')
      }
    })();
    return this.init!;
  }

  public azLgcExpDocEventEmitter?: ValueEventEmitter<AzLgcExpDocument | undefined>;
  public validationResultEventEmitter?: ValueEventEmitter<ValidateResult | undefined>;

  private _rootSymbolTable: SymbolTable;
  private _valueDescriptionDict: ValueDescriptionDictionary;

  public get rootSymbolTable(): SymbolTable{
    return this._rootSymbolTable;
  }
  public set rootSymbolTable(symbolTable:SymbolTable){
    this._rootSymbolTable = symbolTable;
    if (this._rootSymbolTable === SymbolTable.globalSymbolTable){
      this._valueDescriptionDict = SymbolTable.globalValueDescriptionDict;
    }else {
      this._valueDescriptionDict = symbolTable.generateValueDescriptionDictionary();
    }
  }
  public get valueDescriptionDict(): ValueDescriptionDictionary{
    return  this._valueDescriptionDict;
  }

  // todo temporary mark it as private, we gonna implement it latter
  private constructor(
    public readonly documentId: string = AzLogicAppLangConstants.DEFAULT_DOCUMENT_ID,
    _rootSymbolTable: SymbolTable = SymbolTable.globalSymbolTable
  ) {

    try{
      this.rootSymbolTable = _rootSymbolTable;

      AzLogicAppExpressionLanguage.activate().then(() => {

        this.azLgcExpDocEventEmitter = new ValueEventEmitter<AzLgcExpDocument | undefined>(undefined);
        this.validationResultEventEmitter = new ValueEventEmitter<ValidateResult | undefined>(undefined);

      }, reason => {
        if (AzLogicAppExpressionLanguage.globalErrorHandler){
          AzLogicAppExpressionLanguage.globalErrorHandler('[AzLogicAppExpressionLanguage::activate]', reason);
        }else{
          throw reason;
        }
      });
    }catch (err) {
      if (AzLogicAppExpressionLanguage.globalErrorHandler){
        AzLogicAppExpressionLanguage.globalErrorHandler('[AzLogicAppExpressionLanguage::constructor]', err);
      }else{
        throw  err;
      }
    }
  }

  public cleanUp(){
    // noop for now
  }

}
