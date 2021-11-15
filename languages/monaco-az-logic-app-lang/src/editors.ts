import {
  DEFAULT_SEPARATOR,
  INITIAL,
  IRawTheme,
  Position as TmPosition,
  Registry,
  StackElement,
  ValueEventEmitter
} from '@monaco-imposture-tools/core';
import {loadWASM} from '@monaco-imposture-tools/oniguruma-asm';
import {CancellationToken, default as monaco, editor, IDisposable, languages, Position, Range} from './editor.api';
import {ValidateResult} from './validateHelper';
import {debounce} from './debounce';
import {TMToMonacoToken} from './tm-to-monaco-token';
import {generateHover} from './hoverProviderHelper';
import {generateCompletion} from './completionProviderHelper';
import {conf, language} from './languageConfiguration';
import {generateCodeActions} from './codeActionProviderHelper';
import {themes} from './themes';
import {AzLgcExpDocument, parseAzLgcExpDocument} from "./parser";
import {AzLogicAppLangConstants, ErrorHandler, SymbolTable, ValueDescriptionDictionary} from "./base";
import {generateValueDescriptionDictionary} from "./utils";

class TokenizerState implements languages.IState {
  constructor(private _ruleStack: StackElement) {}

  public get ruleStack(): StackElement {
    return this._ruleStack;
  }

  public clone(): TokenizerState {
    return new TokenizerState(this._ruleStack);
  }

  public equals(other: languages.IState): boolean {
    return !(!other || !(other instanceof TokenizerState) || other !== this || other._ruleStack !== this._ruleStack);
  }
}

export class AzLogicAppExpressionLangMonacoEditor {

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

  public static get globalErrorHandler(){
    return AzLogicAppLangConstants.globalErrorHandler;
  }
  public static set globalErrorHandler(handler:ErrorHandler|undefined){
    AzLogicAppLangConstants.globalErrorHandler = handler;
  }

  public static get init() {
    return AzLogicAppLangConstants._init;
  }
  public static get grammar() {
    return AzLogicAppLangConstants._grammar;
  }

  static get theme():IRawTheme{
    return AzLogicAppLangConstants._theme;

  }
  static set theme(nextTheme){
    AzLogicAppLangConstants._usingBuiltInTheme = false;
    AzLogicAppLangConstants._theme = nextTheme;
    if (AzLogicAppLangConstants._registry){
      AzLogicAppLangConstants._registry.setTheme(nextTheme);
    }
  }

  private static _tokenProvider: IDisposable | undefined;
  private static _hoverProvider: IDisposable | undefined;
  private static _completionProvider: IDisposable | undefined;
  private static _codeActionsProvider: IDisposable | undefined;

  private static _curEditorsMap: Map<string, AzLogicAppExpressionLangMonacoEditor> = new Map();

  private static _curAzLgcExpDocsMap: WeakMap<editor.IStandaloneCodeEditor, {versionId: number; azLgcExpDoc: AzLgcExpDocument}> = new WeakMap();

  private static _curDeferredAzLgcExpDocMap: WeakMap<editor.IStandaloneCodeEditor, Promise<AzLgcExpDocument>> = new WeakMap();
  private static _curCodeDocResolverMap: WeakMap<editor.IStandaloneCodeEditor, (azLgcExpDoc: AzLgcExpDocument | undefined| PromiseLike<AzLgcExpDocument>) => void> = new WeakMap();


  static getCodeEditorById(editorId?:string){
    return this._curEditorsMap.get(editorId || AzLogicAppLangConstants.DEFAULT_EDITOR_ID)
  }

  static get defaultEditor() {
    return this._curEditorsMap.get(AzLogicAppLangConstants.DEFAULT_EDITOR_ID);
  }

  private static _doParseSync(
    text: string,
    versionId: number,
    azLgcExpEditor: AzLogicAppExpressionLangMonacoEditor
  ): AzLgcExpDocument | undefined {
    try{
      if (this.grammar && azLgcExpEditor) {
        const itsGlobalSymbolTable = azLgcExpEditor.rootSymbolTable;
        const _cur = this._curAzLgcExpDocsMap.get(azLgcExpEditor.standaloneCodeEditor);
        const azLgcExpDocResult = azLgcExpEditor.azLgcExpDocEventEmitter;
        const validateResult = azLgcExpEditor.validationResultEventEmitter;
        if (!_cur || !versionId || versionId === -1 || _cur?.versionId !== versionId) {

          // force to use the default LF as EOL
          const codeDoc = this.grammar!.parse(text || ' ');

          if (AzLogicAppExpressionLangMonacoEditor.inSyntaxDebugMode){
            if (codeDoc.separator === '\r\n'){
              console.log('[azLgcLang::parseAzLgcExpDocument] EOF CRLF');
            }else{
              console.log('[azLgcLang::parseAzLgcExpDocument] EOF LF');
            }
          }

          const azLgcExpDoc = parseAzLgcExpDocument(codeDoc, itsGlobalSymbolTable);
          azLgcExpDocResult.emit(azLgcExpDoc);

          AzLogicAppExpressionLangMonacoEditor.inSyntaxDebugMode &&
          console.log("[azLgcLang::parseAzLgcExpDocument]", azLgcExpDoc.entries, azLgcExpDoc.validateResult, azLgcExpDoc);
          AzLogicAppExpressionLangMonacoEditor.inSyntaxDebugMode &&
          azLgcExpDoc.consoleLogSyntaxNodes();

          const vr = azLgcExpDoc.validateResult;

          AzLogicAppExpressionLangMonacoEditor.monaco.editor.setModelMarkers(
            azLgcExpEditor.standaloneCodeEditor.getModel(),
            AzLogicAppLangConstants.LANGUAGE_ID,
            vr.problems.map((one) => ({
              severity: one.severity as any,
              code: '' + one.code,
              message: one.message,
              startLineNumber: one.startPos.line + 1,
              startColumn: one.startPos.character + 1,
              endColumn: one.endPos.character + 1,
              endLineNumber: one.endPos.line + 1,
            }))
          );

          validateResult.emit(vr);
          this._curAzLgcExpDocsMap.set(azLgcExpEditor.standaloneCodeEditor, {versionId, azLgcExpDoc});
          return azLgcExpDoc;
        }
      }
      return this._curAzLgcExpDocsMap.get(azLgcExpEditor.standaloneCodeEditor)?.azLgcExpDoc;
    }catch (err) {
      if (this.globalErrorHandler){
        this.globalErrorHandler('[azLgcLang::parseAzLgcExpDocument]', err);
      }else{
        throw  err;
      }
    }
    return
  }
  private static _debouncedDoParseSync = debounce(function (
    text: string,
    versionId: number,
    azLgcExpEditor: AzLogicAppExpressionLangMonacoEditor,
    cb: (azLgcExpDoc: AzLgcExpDocument | undefined )=>void
  ) {
    cb && cb(AzLogicAppExpressionLangMonacoEditor._doParseSync(text, versionId, azLgcExpEditor));
  },
  250);

  private static _doParse(text: string, versionId: number, azLgcExpEditor: AzLogicAppExpressionLangMonacoEditor) {
    let curResolver = this._curCodeDocResolverMap.get(azLgcExpEditor.standaloneCodeEditor);
    if (!curResolver) {
      const deferredCodeDoc = new Promise<AzLgcExpDocument>((resolve, _reject) => {
        curResolver = resolve;
      });
      this._curCodeDocResolverMap.set(azLgcExpEditor.standaloneCodeEditor, curResolver);
      this._curDeferredAzLgcExpDocMap.set(azLgcExpEditor.standaloneCodeEditor, deferredCodeDoc);
    }
    this._debouncedDoParseSync(text, versionId, azLgcExpEditor, (azLgcExpDoc: AzLgcExpDocument | undefined) => {
      curResolver!(azLgcExpDoc);
      this._curCodeDocResolverMap.delete(azLgcExpEditor.standaloneCodeEditor);
    });
    return this._curDeferredAzLgcExpDocMap.get(azLgcExpEditor.standaloneCodeEditor)!;
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

  // todo support json format
  // private static _extJsonGrammar:
  //   | Promise<string | object>
  //   | string
  //   | object = require('../grammar/LogicAppsExtJson.tmLanguage.json');

  static emitBinaryTokens = true;

  static get monaco() {
    if (!AzLogicAppLangConstants._monaco) {
      throw new Error(`Azure logic app expression editor failed to retrieve monaco api`);
    }
    return AzLogicAppLangConstants._monaco;
  }
  static set monaco(_monaco: typeof monaco | undefined) {
    AzLogicAppLangConstants._monaco = _monaco;
  }

  public static activate(
    scannerOrItsPath: string | ArrayBuffer = this._scannerOrItsPath,
    realMonaco: typeof monaco = AzLogicAppLangConstants._monaco,
    grammarContent: Promise<string | object> | string | object = this._grammarContent
  ) {
    if (this.init) return this.init;

    this._scannerOrItsPath = scannerOrItsPath;
    AzLogicAppLangConstants._monaco = realMonaco;
    this._grammarContent = grammarContent;

    if (
      (typeof scannerOrItsPath !== 'string' && !(scannerOrItsPath instanceof ArrayBuffer)) ||
      (!(grammarContent instanceof Promise) &&
        typeof grammarContent !== 'string' &&
        typeof grammarContent !== 'object') ||
      !realMonaco
    ) {
      throw Error(
        `Failed to activate Az logic app exp language: Invalid scannerOrItsPath, grammarContent or monaco language module`
      );
    }

    AzLogicAppLangConstants._init = (async () => {
      await loadWASM(scannerOrItsPath);
      AzLogicAppLangConstants._registry = new Registry({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        debug: AzLogicAppExpressionLangMonacoEditor.inLexicalDebugMode,
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

      const grammar = await AzLogicAppLangConstants._registry.loadGrammar(AzLogicAppLangConstants.SCOPE_NAME);
      AzLogicAppLangConstants._grammar = grammar;

      realMonaco.languages.register({id: AzLogicAppLangConstants.LANGUAGE_ID});
      realMonaco.languages.setLanguageConfiguration(AzLogicAppLangConstants.LANGUAGE_ID, conf);
      realMonaco.languages.setMonarchTokensProvider(AzLogicAppLangConstants.LANGUAGE_ID, language);

      if (this.emitBinaryTokens){
        realMonaco.languages.setColorMap(AzLogicAppLangConstants._registry.getColorMap());
        this._tokenProvider = realMonaco.languages.setTokensProvider(AzLogicAppLangConstants.LANGUAGE_ID, {
          getInitialState(): languages.IState {
            return new TokenizerState(INITIAL);
          },
          tokenizeEncoded(line: string, state: TokenizerState): languages.IEncodedLineTokens {
            try{
              const res = grammar?.tokenizeLine2(line, state.ruleStack);
              AzLogicAppExpressionLangMonacoEditor.inLexicalDebugMode &&
              console.log(`grammar::tokenize2 ${line} ||`, res.tokens, res);
              return {
                endState: new TokenizerState(res.ruleStack),
                tokens: res.tokens
              }
            }catch (err) {
              if (this.globalErrorHandler){
                this.globalErrorHandler('[azLgcLang::grammar::tokenize2]', err);
              }else{
                throw  err;
              }
            }
          }
        })
      }else{
        this._tokenProvider = realMonaco.languages.setTokensProvider(AzLogicAppLangConstants.LANGUAGE_ID, {
          getInitialState(): languages.IState {
            return new TokenizerState(INITIAL);
          },
          tokenize(line: string, state: TokenizerState): languages.ILineTokens {
            try{
              const _curEditorForTknSvc = AzLogicAppExpressionLangMonacoEditor.defaultEditor.standaloneCodeEditor;

              const res = grammar?.tokenizeLine(line, state.ruleStack);

              AzLogicAppExpressionLangMonacoEditor.inLexicalDebugMode &&
              console.log(`grammar::tokenize ${line} ||`, res.tokens, res);

              return {
                endState: new TokenizerState(res.ruleStack),
                tokens: res.tokens.map((token) => ({
                  ...token,
                  // at the moment, monaco-editor doesn't seem to accept array of scopes
                  scopes: _curEditorForTknSvc
                    ? TMToMonacoToken(_curEditorForTknSvc!, token.scopes)
                    : token.scopes[token.scopes.length - 1],
                })),
              };
            }catch (err) {
              if (this.globalErrorHandler){
                this.globalErrorHandler('[azLgcLang::grammar::tokenize]', err);
              }else{
                throw  err;
              }
            }
          },
        });
      }

      this._hoverProvider = realMonaco.languages.registerHoverProvider(AzLogicAppLangConstants.LANGUAGE_ID, {
        provideHover: (model, position) => {
          try{
            const thAzLgcEditor = this.getCodeEditorById(model.id);
            const _curCodeDocEntry = this._curAzLgcExpDocsMap.get(thAzLgcEditor.standaloneCodeEditor);
            if (_curCodeDocEntry) {
              const offset = _curCodeDocEntry.azLgcExpDoc.codeDocument.offsetAt({
                line: position.lineNumber - 1,
                character: position.column - 1,
              });
              const theNode = _curCodeDocEntry.azLgcExpDoc.getSyntaxNodeByOffset(offset);
              return generateHover(theNode, _curCodeDocEntry.azLgcExpDoc);
            }
          }catch (err) {
            if (this.globalErrorHandler){
              this.globalErrorHandler('[azLgcLang::provideHover]', err);
            }else{
              throw  err;
            }
          }
        },
      });

      this._completionProvider = realMonaco.languages.registerCompletionItemProvider(AzLogicAppLangConstants.LANGUAGE_ID, {
        triggerCharacters: ['.', ',', '@'],
        provideCompletionItems: async (
          model: editor.ITextModel,
          position: Position,
          context: languages.CompletionContext,
          token: CancellationToken
        ) => {
          try{
            const theLgcExpDocEditor = this.getCodeEditorById(model.id);
            const _curCodeDoc = this._curAzLgcExpDocsMap.get(theLgcExpDocEditor.standaloneCodeEditor);
            if (_curCodeDoc) {
              const modelLines = model.getLinesContent();
              let theAzLgcExpDoc = _curCodeDoc.azLgcExpDoc;
              if (
                !theAzLgcExpDoc ||
                modelLines.length !== theAzLgcExpDoc.codeDocument.lines.length ||
                modelLines.some((value, index) => value !== theAzLgcExpDoc.codeDocument.lines[index])
              ) {
                theAzLgcExpDoc =
                  (await this._doParse(
                    modelLines.join(theLgcExpDocEditor.getEndOfLine()),
                    model.getVersionId(),
                    theLgcExpDocEditor
                  )) || theAzLgcExpDoc;
              }
              return generateCompletion(theLgcExpDocEditor, theAzLgcExpDoc, model, position, context, token);
            }
          }catch (err) {
            if (this.globalErrorHandler){
              this.globalErrorHandler('[azLgcLang::provideCompletionItems]', err);
            }else{
              throw  err;
            }
          }
          return {
            suggestions: [],
          };
        },
        resolveCompletionItem(
          item: languages.CompletionItem,
          token: CancellationToken
        ): languages.ProviderResult<languages.CompletionItem> {
          AzLogicAppExpressionLangMonacoEditor.inSemanticDebugMode &&
            console.log('[CompletionItemProvider::resolveCompletionItem]', item, token);
          return item;
        },
      });

      this._codeActionsProvider = realMonaco.languages.registerCodeActionProvider(AzLogicAppLangConstants.LANGUAGE_ID, {
        provideCodeActions: (
          model: editor.ITextModel,
          range: Range,
          context: languages.CodeActionContext,
          token: CancellationToken
        ): languages.ProviderResult<languages.CodeActionList> => {
          try{
            return generateCodeActions(model, range, context, token);
          }catch (err) {
            if (this.globalErrorHandler){
              this.globalErrorHandler('[azLgcLang::provideCodeActions]', err);
            }else{
              throw  err;
            }
          }
        },
      });

      AzLogicAppExpressionLangMonacoEditor.inSemanticDebugMode &&
        console.log('[AzLogicAppExpressionLangMonacoEditor init]', this._hoverProvider, this._completionProvider);
    })();
    return this.init;
  }

  public standaloneCodeEditor?: editor.IStandaloneCodeEditor;
  public azLgcExpDocEventEmitter?: ValueEventEmitter<AzLgcExpDocument | undefined>;
  public validationResultEventEmitter?: ValueEventEmitter<ValidateResult | undefined>;

  private _rootSymbolTable: SymbolTable;
  private _valueDescriptionDict: ValueDescriptionDictionary;

  public getEndOfLine(){
    if(this.standaloneCodeEditor){
      return this.standaloneCodeEditor.getModel().getEOL();
    }
    return DEFAULT_SEPARATOR;
  }

  public get rootSymbolTable(): SymbolTable{
    return this._rootSymbolTable;
  }
  public set rootSymbolTable(symbolTable:SymbolTable){
    this._rootSymbolTable = symbolTable;
    if (this._rootSymbolTable === AzLogicAppLangConstants.globalSymbolTable){
      this._valueDescriptionDict = AzLogicAppLangConstants.globalValueDescriptionDict;
    }else {
      this._valueDescriptionDict = generateValueDescriptionDictionary(symbolTable);
    }
    // force re-parsing if the editor existed
    if(this.standaloneCodeEditor){
      const theValStr = this.standaloneCodeEditor!.getValue();
      if (theValStr) {
        AzLogicAppExpressionLangMonacoEditor._doParse(theValStr, -1, this);
      }
    }
  }
  public get valueDescriptionDict(): ValueDescriptionDictionary{
    return  this._valueDescriptionDict;
  }

  constructor(
    public readonly domeElement: HTMLDivElement,
    standaloneEditorConstructionOptions?: Omit<editor.IStandaloneEditorConstructionOptions, 'language' | 'model'>,
    public readonly editorId: string = AzLogicAppLangConstants.DEFAULT_EDITOR_ID,
    _rootSymbolTable: SymbolTable = AzLogicAppLangConstants.globalSymbolTable
  ) {

    try{
      this.rootSymbolTable = _rootSymbolTable;

      if (
        AzLogicAppLangConstants._usingBuiltInTheme &&
        standaloneEditorConstructionOptions.theme &&
        standaloneEditorConstructionOptions.theme in themes
      ){
        AzLogicAppLangConstants._theme = themes[standaloneEditorConstructionOptions.theme];
      }

      AzLogicAppExpressionLangMonacoEditor.activate().then(() => {

        const theTextModel = Object.assign(
          AzLogicAppLangConstants._monaco.editor.createModel(
            (standaloneEditorConstructionOptions?.value || '').replace(/\r/gm, ""),
            AzLogicAppLangConstants.LANGUAGE_ID
          ),
          {
            id: editorId,
          }
        );
        // force to use LF as eol
        theTextModel.pushEOL(0);
        this.standaloneCodeEditor = AzLogicAppLangConstants._monaco.editor.create(domeElement, {
          language: AzLogicAppLangConstants.LANGUAGE_ID,
          model: theTextModel,
          ...standaloneEditorConstructionOptions,
        });

        this.azLgcExpDocEventEmitter = new ValueEventEmitter<AzLgcExpDocument | undefined>(undefined);
        this.validationResultEventEmitter = new ValueEventEmitter<ValidateResult | undefined>(undefined);

        AzLogicAppExpressionLangMonacoEditor._curEditorsMap.set(editorId, this);

        // setup default editor if needed
        if (
          !AzLogicAppExpressionLangMonacoEditor._curEditorsMap.has(AzLogicAppLangConstants.DEFAULT_EDITOR_ID)
        ) {
          AzLogicAppExpressionLangMonacoEditor._curEditorsMap.set(
            AzLogicAppLangConstants.DEFAULT_EDITOR_ID,
            this
          );
        }

        const theValStr = this.standaloneCodeEditor.getValue();
        if (theValStr) {
          AzLogicAppExpressionLangMonacoEditor._doParse(theValStr, -1, this);
        }
        this.standaloneCodeEditor.getModel()?.onDidChangeContent((evt) => {
          const theValStr = this.standaloneCodeEditor!.getValue();
          if (typeof theValStr === 'string') {
            AzLogicAppExpressionLangMonacoEditor._doParse(theValStr, evt.versionId, this);
          }
        });
        // phase 2 todo: it feels like onDidChangeOptions cannot catch eol changing
        // this.standaloneCodeEditor.getModel()?.onDidChangeOptions((evt)=>{
        //   if (this.standaloneCodeEditor.getModel().getEOL() === '\r\n'){
        //     // force to use LF as EOL
        //     this.standaloneCodeEditor.getModel().pushEOL(0);
        //     if (AzLogicAppExpressionLangMonacoEditor.inSyntaxDebugMode){
        //       console.log('[azLgcLang::standaloneCodeEditor] onDidChangeOptions set EOL from CRLF to LF by force');
        //     }
        //   }
        // })
      }, reason => {
        if (AzLogicAppExpressionLangMonacoEditor.globalErrorHandler){
          AzLogicAppExpressionLangMonacoEditor.globalErrorHandler('[azLgcLang::activate]', reason);
        }else{
          throw reason;
        }
      });
    }catch (err) {
      if (AzLogicAppExpressionLangMonacoEditor.globalErrorHandler){
        AzLogicAppExpressionLangMonacoEditor.globalErrorHandler('[azLgcLang::constructor]', err);
      }else{
        throw  err;
      }
    }
  }

  get azLgcExpDocument() {
    return AzLogicAppExpressionLangMonacoEditor._curAzLgcExpDocsMap.get(this.standaloneCodeEditor)?.azLgcExpDoc;
  }

  get deferredAzLgcExpDocument() {
    return AzLogicAppExpressionLangMonacoEditor._curDeferredAzLgcExpDocMap.get(this.standaloneCodeEditor);
  }

  get currentPosition(){
    return this.standaloneCodeEditor?.getPosition();
  }

  get currentOffset(){
    const curPos = this.currentPosition;
    const curDoc = this.azLgcExpDocument;
    if (curDoc && curPos){
      return curDoc.codeDocument.offsetAt(TmPosition.create(curPos.lineNumber-1, curPos.column-1));
    }
    return 0;
  }

  get currentSelection(){
    return this.standaloneCodeEditor?.getSelection();
  }

  get currentSelectionOffsetArray(){
    const result:number[] = [];
    const curSel = this.currentSelection;
    const curDoc = this.azLgcExpDocument;
    if(curDoc && curSel){
      result.push(curDoc.codeDocument.offsetAt(TmPosition.create(curSel.startLineNumber-1, curSel.startColumn-1)));
      result.push(curDoc.codeDocument.offsetAt(TmPosition.create(curSel.endLineNumber-1, curSel.endColumn-1)));
    }
    return result;
  }

}
