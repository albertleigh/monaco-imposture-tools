import React, {forwardRef, memo, RefObject, useRef, useEffect, useState, useCallback} from 'react';
import {
  default as AzLogicAppExpressionLang,
  IdentifierType,
  AzLogicAppExpressionLangMonacoEditor,
  Problem,
  createPkgValDesc,
  createRefValDesc,
  createFunValDesc,
  createSymbolTable,
  createFunRetDesc,
  createOverloadedFunValDesc, AzLgcExpDocument, ValidateResult, Range
} from 'monaco-azure-logic-app-lang';
import ReactJson, {OnSelectProps} from 'react-json-view';
import scannerPath from 'monaco-azure-logic-app-lang/scanner/scanner.wasm';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {Selection as MonacoSelection} from 'monaco-editor/esm/vs/editor/editor.api';

import "./styles.css";

AzLogicAppExpressionLang.scannerOrItsPath = scannerPath;
AzLogicAppExpressionLang.monaco = monaco;
AzLogicAppExpressionLang.inLexicalDebugMode = false;
AzLogicAppExpressionLang.inSyntaxDebugMode = true;
AzLogicAppExpressionLang.inSemanticDebugMode = true;

let ST_GENERATOR_SEED = 1;

export function findDeepestRangeBy(root: any, namespaces: (string | null)[]): Range | undefined {
  let result: Range | undefined = undefined;
  let workingNode: any = root;

  namespaces = namespaces.slice();

  while (namespaces.length) {
    if (!workingNode || !namespaces[0]) break;
    workingNode = workingNode[namespaces.shift()!];
    if (workingNode['$impostureLangMeta']?.range) {
      const rangeInMeta = workingNode['$impostureLangMeta']?.range;
      result = Range.create(
        rangeInMeta.start.line,
        rangeInMeta.start.character,
        rangeInMeta.end.line,
        rangeInMeta.end.character
      );
    }
  }

  return result;
}

function generateNextSymbolTable() {
  const nextSeed = ST_GENERATOR_SEED++;
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
      activity: createOverloadedFunValDesc([
          'Activity get Metedata 1'
        ],
        [
          [IdentifierType.CONSTANT('Get Metadata1')]
        ],
        [IdentifierType.FUNCTION_RETURN_TYPE(['activity'])]
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
          globalParameters: createPkgValDesc(
            [
              'Global parameter package'
            ],
            {
              firstGlobalStrPara: createRefValDesc(['firstGlobalStrPara'], IdentifierType.String),
              oneGlobalNumber: createRefValDesc(['oneGlobalNumber'], IdentifierType.Number),
              oneGlobalFloat: createRefValDesc(['oneGlobalNumber'], IdentifierType.Number),
              oneGlobalBoolean: createRefValDesc(['oneGlobalNumber'], IdentifierType.Boolean),
              oneGlobalArr: createRefValDesc(['oneGlobalNumber'], IdentifierType.Array, true, []),
              oneGlobalObj: createRefValDesc(['oneGlobalObj'], IdentifierType.AnyObject, true, {}),
              oneTypedObj: createPkgValDesc(['oneTypedObj'], {
                anotherStrPara: createRefValDesc(['anotherStrPara'], IdentifierType.String),
                anotherGlobalNumber: createRefValDesc(['anotherGlobalNumber'], IdentifierType.Number),
                anotherGlobalFloat: createRefValDesc(['anotherGlobalFloat'], IdentifierType.Number),
                anotherGlobalBoolean: createRefValDesc(['anotherGlobalBoolean'], IdentifierType.Boolean),
                anotherGlobalArr: createRefValDesc(['anotherGlobalArr'], IdentifierType.Array, true, []),
                anotherGlobalObj: createRefValDesc(['anotherGlobalObj'], IdentifierType.AnyObject, true, {}),
              }),
            }
          )
        }),
        activity: createPkgValDesc(['**Return package activity**', 'Package activity'], {
          output: createRefValDesc(
            ['output'],
            IdentifierType.Any
          )
        }, {allowAdditionalAnyProperties: true})
      })
    )
  );
}

const rootSymbolTable = generateNextSymbolTable();

const sampleCodes = ``;

const MONACO_EDITOR_ID = 'dummy-monaco-sandbox-editor';

const MonacoEditorDiv = memo<{ref: RefObject<HTMLDivElement>}>(
  forwardRef((prps, ref) => {
    return <div id={MONACO_EDITOR_ID} style={{height: '100%'}} ref={ref as any} />;
  }) as any
);

export default function App() {

  const monacoEditorDiv = useRef<HTMLDivElement>(null);

  const monacoEditor = useRef<{
    editor?: AzLogicAppExpressionLangMonacoEditor;
    element?: HTMLDivElement;
  }>({});

  const [astTreeRoot, setAstTreeRoot] = useState({});
  const [problems, setProblems] = useState<Problem[]>([]);

  const doHighlightRang = useCallback(
    (select: OnSelectProps) => {
      const range = findDeepestRangeBy(astTreeRoot, select.namespace);
      if (range) {
        monacoEditor.current.editor?.standaloneCodeEditor?.setSelection(
          new MonacoSelection(
            range.start.line + 1,
            range.start.character + 1,
            range.end.line + 1,
            range.end.character + 1
          )
        );
      }
    },
    [astTreeRoot]
  );

  const regenerateSymbolTable = useCallback(()=>{
    if (monacoEditor.current.editor){
      monacoEditor.current.editor.rootSymbolTable = generateNextSymbolTable();
    }
  },[])

  useEffect(() => {
    function subscribeCodeDoc(azLgcExpDocument?: AzLgcExpDocument) {
      if (azLgcExpDocument) {
        const curAstTreeStr = azLgcExpDocument.codeDocument.printASTNode();
        if (curAstTreeStr) {
          setAstTreeRoot(JSON.parse(curAstTreeStr));
        }
      }
    }

    function subscribeValidateResult(vr?: ValidateResult) {
      setProblems(vr?.problems || []);
    }

    if (monacoEditorDiv.current) {
      monacoEditor.current.element = monacoEditorDiv.current;
      monacoEditor.current.editor = new AzLogicAppExpressionLangMonacoEditor(
        monacoEditor.current.element,
        {
          theme: 'vs-dark',
          // theme: 'vs-code-theme-converted',
          // readOnly: true,
          contextmenu: false,
          value: sampleCodes,
          automaticLayout: true,
        },
        MONACO_EDITOR_ID,
        rootSymbolTable
      );
      AzLogicAppExpressionLangMonacoEditor.init!.then(() => {
        monacoEditor.current.editor?.azLgcExpDocEventEmitter?.subscribe(subscribeCodeDoc);
        monacoEditor.current.editor?.validationResultEventEmitter?.subscribe(subscribeValidateResult);
      });
    }

    return () => {
      monacoEditor.current.editor?.azLgcExpDocEventEmitter?.unsubscribe(subscribeCodeDoc);
      monacoEditor.current.editor?.validationResultEventEmitter?.unsubscribe(subscribeValidateResult);
    };
  }, []);

  return (
    <div className='outermost-ctn'>
      <div className='syntax-ctn'>
        <ReactJson theme="monokai" collapsed={3} onSelect={doHighlightRang} src={astTreeRoot} />
      </div>
      <div className='problem-ctn'>
        <pre>
          {JSON.stringify(
            problems,
            (key, value) => {
              if (key === 'node') {
                return undefined;
              }
              return value;
            },
            2
          )}
        </pre>
      </div>
      <div className='editor-ctn'>
        <MonacoEditorDiv ref={monacoEditorDiv} />
      </div>
      <div className='btn-ctn'>
        <button onClick={regenerateSymbolTable}>Change ST</button>
      </div>
    </div>
  );
}
