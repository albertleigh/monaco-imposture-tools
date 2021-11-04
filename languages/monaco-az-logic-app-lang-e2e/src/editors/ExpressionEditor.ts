import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {
  default as AzLogicAppExpressionLang,
  IdentifierType,
  AzLgcExpDocument,
  AzLogicAppExpressionLangMonacoEditor,
  ValidateResult,
  createPkgValDesc,
  createRefValDesc,
  createFunValDesc,
  createSymbolTable,
  createFunRetDesc,
  createOverloadedFunValDesc
} from 'monaco-azure-logic-app-lang';

AzLogicAppExpressionLang.scannerOrItsPath = `assets/scanner.wasm`;
AzLogicAppExpressionLang.monaco = monaco;
AzLogicAppExpressionLang.emitBinaryTokens = true;
AzLogicAppExpressionLang.inSyntaxDebugMode = true;
AzLogicAppExpressionLang.inSemanticDebugMode = true;

const sampleCodes = "";

export const MONACO_EDITOR_ID = 'first-expression-monaco-editor';

(window as any).ST_GENERATOR_SEED = 1;

function generateNextSymbolTable() {
  const nextSeed = (window as any).ST_GENERATOR_SEED++;
  return createSymbolTable(
    {
      [`dynamic${nextSeed}`]:createFunValDesc(
        [
          `**dynamic${nextSeed}()**`,
          `Dynamic function ${nextSeed}`
        ],
        [IdentifierType.CONSTANT(nextSeed)],
        IdentifierType.Number
      ),
      variables: createOverloadedFunValDesc([
          'Variable one',
          'Variable two',
          'Variable three',
        ],
        [
          [IdentifierType.CONSTANT('firstVar')],
          [IdentifierType.CONSTANT('secondVar')],
          [IdentifierType.CONSTANT('thirdVar')]
        ],
        [IdentifierType.String, IdentifierType.String, IdentifierType.String]
      ),
      pipeline: createFunValDesc(
        ['**pipeline()**', 'Return pipeline object'],
        [],
        IdentifierType.FUNCTION_RETURN_TYPE(['pipeline'])
      ),
      item: createFunValDesc(
        ['**item()**', 'An item object returned'],
        [],
        IdentifierType.Any
      )
    },
    createFunRetDesc(
      createPkgValDesc([],{
        pipeline: createPkgValDesc(['**Return package pipeline**', 'Package pipeline'], {
          DataFactory: createRefValDesc(
            ['Name of the data factory the pipeline run is running within'],
            IdentifierType.String
          ),
          Pipeline: createRefValDesc(['Pipeline Name'], IdentifierType.String),
          GroupId: createRefValDesc(['ID of the group to which the pipeline run belongs'], IdentifierType.String),
          RunId: createRefValDesc(['ID of the specific pipeline run'], IdentifierType.String),
          TriggerId: createRefValDesc(['ID of the trigger that invokes the pipeline'], IdentifierType.String),
          TriggerName: createRefValDesc(['Name of the trigger that invokes the pipeline'], IdentifierType.String),
          TriggerTime: createRefValDesc(
            [
              'Time when the trigger that invoked the pipeline. The trigger time is the actual fired time, not the scheduled time. For example, 13:20:08.0149599Z is returned instead of 13:20:00.00Z',
            ],
            IdentifierType.String
          ),
          TriggerType: createRefValDesc(
            ['Type of the trigger that invoked the pipeline (Manual, Scheduler)'],
            IdentifierType.String
          ),
          TriggeredByPipelineName: createRefValDesc(
            [
              'Name of the pipeline that triggered this pipeline. Applicable when a pipeline run is triggered by an Execute Pipeline activity; Evaluates to Null when used in other circumstances.',
            ],
            IdentifierType.String,
            true
          ),
          TriggeredByPipelineRunId: createRefValDesc(
            [
              'Run ID of the pipeline that triggered this pipeline. Applicable when a pipeline run is triggered by an Execute Pipeline activity; Evaluates to Null when used in other circumstances.',
            ],
            IdentifierType.String,
            true
          ),
        }),
      })
    )
  );
}

const rootSymbolTable = generateNextSymbolTable();

function subscribeCodeDoc(azLgcExpDocument?: AzLgcExpDocument) {
  if (azLgcExpDocument) {
    (window as any).expCodeDocument = azLgcExpDocument.codeDocument;
    (window as any).expCodeDocumentText = azLgcExpDocument.codeDocument.text;
  }
}

function subscribeValidateResult(vr?: ValidateResult) {
  (window as any).expProblems = vr?.problems || [];
}

export const mount = (root:HTMLDivElement)=> {
  // noop
  const theEditor = new AzLogicAppExpressionLangMonacoEditor(
    root,
    {
      theme: 'hc-black',
      // theme: 'vs-code-theme-converted',
      // readOnly: true,
      contextmenu: false,
      value: sampleCodes,
      automaticLayout: true,
    },
    MONACO_EDITOR_ID,
    rootSymbolTable
  )
  AzLogicAppExpressionLangMonacoEditor.init.then(()=>{
    theEditor.azLgcExpDocEventEmitter?.subscribe(subscribeCodeDoc);
    theEditor.validationResultEventEmitter?.subscribe(subscribeValidateResult);
    (window as any).regenerateNextSymbolTable = function () {
      theEditor.rootSymbolTable = generateNextSymbolTable();
    }
  })
}
