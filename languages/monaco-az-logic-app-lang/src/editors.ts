import {CodeDocument, IGrammar, INITIAL, Registry, StackElement, ValueEventEmitter} from "@monaco-imposture-tools/core";
import {loadWASM} from "@monaco-imposture-tools/oniguruma-asm";
import {CancellationToken, IDisposable, editor, languages, Position} from "./editor.api";
import {default as monaco} from "./editor.api";
import {DiagnosticSeverity, validateCodeDocument, ValidateResult} from "./validateHelper";
import {debounce} from "./debounce";
import {TMToMonacoToken} from "./tm-to-monaco-token";
import {generateHover} from "./hoverProviderHelper";
import {generateCompletion} from "./completionProviderHelper";
class TokenizerState implements languages.IState {

  constructor(
    private _ruleStack: StackElement
  ) { }

  public get ruleStack(): StackElement {
    return this._ruleStack
  }

  public clone(): TokenizerState {
    return new TokenizerState(this._ruleStack);
  }

  public equals(other: languages.IState): boolean {
    return !(!other ||
      !(other instanceof TokenizerState) ||
      other !== this ||
      other._ruleStack !== this._ruleStack);
  }
}

export class AzLogicAppExpressionLangMonacoEditor {

  static readonly SCOPE_NAME = 'source.azLgcAppExp';                     // source.js      ->    source.azLgcAppExp
  static readonly LANGUAGE_ID = 'azureLogicAppExpression';               // javascript     ->    azureLogicAppExpression
  static readonly DEFAULT_EDITOR_ID = 'az-lg-app-exp-default-editor'

  static inDebugMode: boolean = false;

  public static _init:Promise<any> | undefined = undefined;
  public static get init(){
    return this._init;
  }
  public static _grammar:  IGrammar | undefined = undefined;
  public static get grammar(){
    return this._grammar
  }
  private static _tokenProvider: IDisposable | undefined;
  private static _hoverProvider: IDisposable | undefined;
  private static _completionProvider: IDisposable| undefined;

  private static _curEditorsMap: Map<string, editor.IStandaloneCodeEditor> = new Map();
  private static _codeDocsEvtEmitterMap: Map<string, ValueEventEmitter<CodeDocument|undefined>> = new Map();
  private static _validationResultEvtEmitterMap: Map<string, ValueEventEmitter<ValidateResult|undefined>> = new Map();

  private static _curCodeDocsMap: Map<string, { versionId:number, codeDoc:CodeDocument }> = new Map();
  private static _curDeferredCodeDocMap: Map<string, Promise<CodeDocument>> = new Map();
  private static _curCodeDocResolverMap: Map<string, (val: any)=>any> = new Map();

  static get defaultEditor (){
    return this._curEditorsMap.get(this.DEFAULT_EDITOR_ID);
  }

  private static _doParseSync(text:string, versionId:number, editorId:string = this.DEFAULT_EDITOR_ID):CodeDocument|undefined{
    if (this.grammar){
      let _cur = this._curCodeDocsMap.get(editorId);
      const codeDocResult = this._codeDocsEvtEmitterMap.get(editorId)!;
      const validateResult = this._validationResultEvtEmitterMap.get(editorId)!;
      if (!_cur || !versionId || versionId === -1 || _cur?.versionId !== versionId){
        const codeDoc = this.grammar!.parse(text || " ");
        codeDocResult.emit(codeDoc);
        validateResult.emit(validateCodeDocument(codeDoc));
        this._curCodeDocsMap.set(editorId, {versionId, codeDoc});
        return codeDoc;
      }
    }
    return this._curCodeDocsMap.get(editorId)?.codeDoc;
  }
  private static _debouncedDoParseSync = debounce(function (text:string, versionId:number, editorId:string = AzLogicAppExpressionLangMonacoEditor.DEFAULT_EDITOR_ID, cb:any) {
    cb && cb(AzLogicAppExpressionLangMonacoEditor._doParseSync(
      text, versionId, editorId
    ))
  }, 250)

  private static _doParse(text:string, versionId:number, editorId:string = this.DEFAULT_EDITOR_ID){
    let curResolver = this._curCodeDocResolverMap.get(editorId);
    if (!curResolver){
      const deferredCodeDoc = new Promise<CodeDocument>((resolve, reject) => {
        curResolver = resolve;
      })
      this._curCodeDocResolverMap.set(editorId, curResolver!);
      this._curDeferredCodeDocMap.set(editorId, deferredCodeDoc);
    }
    this._debouncedDoParseSync(text, versionId, editorId, (codeDoc: CodeDocument|undefined)=>{
      curResolver!(codeDoc);
      this._curCodeDocResolverMap.delete(editorId);
    });
    return this._curDeferredCodeDocMap.get(editorId)!;
  }

  private static _scannerOrItsPath: string | ArrayBuffer;
  static set scannerOrItsPath(scannerOrItsPath: string | ArrayBuffer){
    this._scannerOrItsPath = scannerOrItsPath;
  }
  //enhance it to support string val
  private static _grammarContent: Promise<string| object>|string|object = require('../grammar/LogicApps.tmLanguage.json');
  static set grammarContent(grammarContent: Promise<string| object>|string|object){
    this._grammarContent = grammarContent;
  }

  private static _monaco: typeof monaco| undefined;
  static get monaco(){
    if (!this._monaco){
      throw new Error(`Azure logic app expression editor failed to retrieve monaco api`);
    }
    return this._monaco;
  }
  static set monaco(_monaco: typeof monaco| undefined){
    this._monaco = _monaco;
  }

  public static activate(
    scannerOrItsPath: string | ArrayBuffer = this._scannerOrItsPath,
    realMonaco: typeof monaco = this._monaco,
    grammarContent: Promise<string| object>|string|object = this._grammarContent
  ){
    if (this.init) return this.init;

    this._scannerOrItsPath = scannerOrItsPath;
    this._monaco = realMonaco;
    this._grammarContent = grammarContent;

    if (
      (
        typeof scannerOrItsPath !== 'string' &&
        !(scannerOrItsPath instanceof ArrayBuffer)
      ) || (
        !(grammarContent instanceof Promise) &&
        typeof grammarContent !== 'string' &&
        typeof grammarContent !== 'object'
      ) || !realMonaco
    ){
      throw Error(`Failed to activate Az logic app exp language: Invalid scannerOrItsPath, grammarContent or monaco language module`);
    }

    this._init = (async ()=>{
      await loadWASM(scannerOrItsPath);
      const registry = new Registry({
        getGrammarDefinition: async (scopeName) => {
          return {
            format: 'json',
            // todo might not need to await
            content: grammarContent instanceof Promise ?
              await grammarContent:
              grammarContent
          }
        }
      })
      const grammar = await registry.loadGrammar(AzLogicAppExpressionLangMonacoEditor.SCOPE_NAME);
      this._grammar = grammar

      realMonaco.languages.register({id: this.LANGUAGE_ID})
      this._tokenProvider = realMonaco.languages.setTokensProvider(this.LANGUAGE_ID, {
        getInitialState(): languages.IState {
          return new TokenizerState(INITIAL);
        },
        tokenize(line: string, state: TokenizerState): languages.ILineTokens {
          // todo remove this _curEditorForTknSvc once we switch to tokens in binary
          const _curEditorForTknSvc = AzLogicAppExpressionLangMonacoEditor.defaultEditor;

          const res = grammar?.tokenizeLine(line, state.ruleStack)

          AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
            console.log(`grammar::tokenize ${line} ||`, res.tokens, res);

          return {
            endState: new TokenizerState(res.ruleStack),
            tokens: res.tokens.map(token => ({
              ...token,
              // todo: At the moment, monaco-editor doesn't seem to accept array of scopes
              scopes: _curEditorForTknSvc ? TMToMonacoToken(_curEditorForTknSvc!, token.scopes) : token.scopes[token.scopes.length - 1]
            })),
          }
        }
      });

      this._hoverProvider = realMonaco.languages.registerHoverProvider(this.LANGUAGE_ID, {
        provideHover: (model, position) => {
          const _curCodeDocEntry = this._curCodeDocsMap.get(model.id || this.DEFAULT_EDITOR_ID);
          if (_curCodeDocEntry){
            const offset = _curCodeDocEntry.codeDoc.offsetAt({
              line: position.lineNumber-1,
              character: position.column-1
            })
            const theNode = _curCodeDocEntry.codeDoc.getNodeByOffset(offset);
            return generateHover(theNode, _curCodeDocEntry.codeDoc);
          }
        },
      });

      this._completionProvider = realMonaco.languages.registerCompletionItemProvider(this.LANGUAGE_ID, {
        triggerCharacters: [".", ",", "@"],
        provideCompletionItems: async (model: editor.ITextModel, position: Position, context: languages.CompletionContext, token: CancellationToken) => {
          const _curCodeDoc = this._curCodeDocsMap.get(model.id || this.DEFAULT_EDITOR_ID);
          if (_curCodeDoc){
            const modelLines = model.getLinesContent();
            let theCodeDoc = _curCodeDoc.codeDoc;
            if (
              modelLines.length!== theCodeDoc.lines.length ||
              !theCodeDoc ||
              modelLines.some((value, index) => (value !== theCodeDoc.lines[index]))
            ){
              theCodeDoc = (await this._doParse(
                  modelLines.join(CodeDocument.DEFAULT_SEPARATOR),
                  model.getVersionId(),
                  model.id
                )) ||
                theCodeDoc
            }
            return generateCompletion(theCodeDoc, model, position, context, token);
          }
          return {
            suggestions: []
          }
        },
        resolveCompletionItem(item: languages.CompletionItem, token: CancellationToken): languages.ProviderResult<languages.CompletionItem> {
          AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
            console.log("[CompletionItemProvider::resolveCompletionItem]", item, token);
          return item;
        }
      });

      AzLogicAppExpressionLangMonacoEditor.inDebugMode &&
        console.log('[AzLogicAppExpressionLangMonacoEditor init]', this._hoverProvider, this._completionProvider);

    })();
    return this.init;
  }


  standaloneCodeEditor?:editor.IStandaloneCodeEditor;
  codeDocEventEmitter?:ValueEventEmitter<CodeDocument|undefined>;
  validationResultEventEmitter?:ValueEventEmitter<ValidateResult|undefined>;

  editorDecoration: string[] = [];
  private _onVrChanged(vr?:ValidateResult){
    const problems = vr?.problems || [];
    if (this.standaloneCodeEditor){
      this.editorDecoration = this.standaloneCodeEditor.deltaDecorations(
        this.editorDecoration,
        problems.filter(one=> one.severity === DiagnosticSeverity.Error).map(one=>({
          range: {
            startColumn: one.startPos.character+1,
            startLineNumber: one.startPos.line+1,
            endColumn: one.endPos.character+1,
            endLineNumber: one.endPos.line+1,
          },
          options:{
            inlineClassName:'errorDecorator',
            hoverMessage: [{
              isTrusted: true,
              value:one.message
            }]
          }
        }))
      ) || [];
    }
  }

  constructor(
    public readonly domeElement:HTMLDivElement,
    standaloneEditorConstructionOptions?:Omit<editor.IStandaloneEditorConstructionOptions, 'language'|'model'>,
    public readonly editorId:string = AzLogicAppExpressionLangMonacoEditor.DEFAULT_EDITOR_ID,
  ) {
    AzLogicAppExpressionLangMonacoEditor.activate().then(
      ()=>{
        this.standaloneCodeEditor = AzLogicAppExpressionLangMonacoEditor._monaco.editor.create(domeElement, {
          language: AzLogicAppExpressionLangMonacoEditor.LANGUAGE_ID,
          model: Object.assign(AzLogicAppExpressionLangMonacoEditor._monaco.editor.createModel(
            standaloneEditorConstructionOptions?.value || ' '
            , AzLogicAppExpressionLangMonacoEditor.LANGUAGE_ID
          ),{
            id: editorId
          }),
          ...standaloneEditorConstructionOptions
        });
        this.codeDocEventEmitter = new ValueEventEmitter<CodeDocument|undefined>(undefined);
        this.validationResultEventEmitter = new ValueEventEmitter<ValidateResult|undefined>(undefined);
        AzLogicAppExpressionLangMonacoEditor._curEditorsMap.set(editorId, this.standaloneCodeEditor);
        AzLogicAppExpressionLangMonacoEditor._codeDocsEvtEmitterMap.set(editorId, this.codeDocEventEmitter);
        AzLogicAppExpressionLangMonacoEditor._validationResultEvtEmitterMap.set(editorId, this.validationResultEventEmitter);

        this.validationResultEventEmitter.subscribe(this._onVrChanged.bind(this));

        // setup default editor if needed
        if (!AzLogicAppExpressionLangMonacoEditor._curEditorsMap.has(AzLogicAppExpressionLangMonacoEditor.DEFAULT_EDITOR_ID)){
          AzLogicAppExpressionLangMonacoEditor._curEditorsMap.set(AzLogicAppExpressionLangMonacoEditor.DEFAULT_EDITOR_ID, this.standaloneCodeEditor);
          AzLogicAppExpressionLangMonacoEditor._validationResultEvtEmitterMap.set(AzLogicAppExpressionLangMonacoEditor.DEFAULT_EDITOR_ID, this.validationResultEventEmitter);
        }

        const theValStr = this.standaloneCodeEditor.getValue();
        if (theValStr){
          AzLogicAppExpressionLangMonacoEditor._doParse(
            theValStr,
            -1,
            this.editorId
          )
        }
        this.standaloneCodeEditor.getModel()?.onDidChangeContent(evt => {
          const theValStr = this.standaloneCodeEditor!.getValue();
          if (theValStr){
            AzLogicAppExpressionLangMonacoEditor._doParse(
              theValStr,
              evt.versionId,
              this.editorId
            )
          }
        })
      }
    )
  }

  get codeDocument (){
    return AzLogicAppExpressionLangMonacoEditor._curCodeDocsMap.get(this.editorId)?.codeDoc;
  }

  get parsedCodeDocument (){
    return AzLogicAppExpressionLangMonacoEditor._curDeferredCodeDocMap.get(this.editorId);
  }

}
