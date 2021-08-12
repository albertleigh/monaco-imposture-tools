import React, {forwardRef, memo, RefObject, useRef, useEffect, useState, useCallback} from 'react';
import ReactJson, {OnSelectProps} from 'react-json-view'
import { makeStyles } from '@material-ui/core/styles';
import {
  Selection as MonacoSelection
} from 'monaco-editor/esm/vs/editor/editor.api';

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import {findDeepestRangeBy} from "../utils/objects";
import {default as AzLogicAppExpressionLang, AzLogicAppExpressionLangMonacoEditor, Problem, ValidateResult, CodeDocument} from "monaco-azure-logic-app-lang";

const isAzLogic = true

AzLogicAppExpressionLang.scannerOrItsPath = `assets/scanner.wasm`;
AzLogicAppExpressionLang.monaco = monaco;
// AzLogicAppExpressionLang.inDebugMode = true;

const useStyles = makeStyles((theme)=>({
  '@global':{
    ".errorDecorator":{
      textDecoration: 'red underline dotted'
    },
  },
  outermostCtn:{
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gridTemplateRows: 'repeat(2, 1fr)',
    height: "100%"
  },
  syntaxCtn:{
    overflow: "auto",
    gridColumnStart: 1,
    gridColumnEnd: 2,
    gridRowStart: 1,
    gridRowEnd:3
  },
  problemCtn:{
    overflow: "auto",
    gridColumnStart: 2,
    gridColumnEnd: 3,
    gridRowStart: 2,
    gridRowEnd:3
  },
  editorCtn:{
    // paddingTop: theme.spacing(1),
    gridColumnStart: 2,
    gridColumnEnd: 3,
    gridRowStart: 1,
    gridRowEnd:2
  }
}))

const sampleCodes =
  isAzLogic?
`@concat(pipeline().DataFactory, pipeline().GroupId)`:
`global.langReg.loadGrammar("source.json", 2, true, null).some.other.field
`;

const MONACO_EDITOR_ID = 'first-dummy-monaco-editor';

const MonacoEditorDiv = memo<{ref:RefObject<HTMLDivElement>}>(forwardRef((prps, ref)=>{
  return<div id={MONACO_EDITOR_ID} style={{height: "100%"}} ref={ref as any}/>
}) as any)


export const DummyEditor:React.FC = React.memo(function DummyEditor() {

  const clazz = useStyles();

  const monacoEditorDiv = useRef<HTMLDivElement>(null);
  const monacoEditor = useRef<{
    editor?:  AzLogicAppExpressionLangMonacoEditor
    element?: HTMLDivElement
  }>({})

  const [astTreeRoot, setAstTreeRoot] = useState({})
  const [problems, setProblems] = useState<Problem[]>([])

  const doHighlightRang = useCallback((select: OnSelectProps)=>{
    const range = findDeepestRangeBy(astTreeRoot, select.namespace);
    if (range){
      monacoEditor.current.editor?.standaloneCodeEditor?.setSelection(
        new MonacoSelection(range.start.line+1, range.start.character+1, range.end.line+1, range.end.character+1)
      )
    }
  },[astTreeRoot])

  useEffect(()=>{

    function subscribeCodeDoc(codeDoc?:CodeDocument){
      if (codeDoc){
        const curAstTreeStr = codeDoc?.printASTNode();
        if (curAstTreeStr){
          setAstTreeRoot(JSON.parse(curAstTreeStr));
        }
      }
    }

    function subscribeValidateResult(vr?:ValidateResult){
      setProblems(vr?.problems || []);
    }

    if (monacoEditorDiv.current){
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
        MONACO_EDITOR_ID
      )
      AzLogicAppExpressionLangMonacoEditor.init!.then(() => {
        monacoEditor.current.editor?.codeDocEventEmitter?.subscribe(subscribeCodeDoc);
        monacoEditor.current.editor?.validationResultEventEmitter?.subscribe(subscribeValidateResult);
      });
    }

    return ()=>{
      monacoEditor.current.editor?.codeDocEventEmitter?.unsubscribe(subscribeCodeDoc);
      monacoEditor.current.editor?.validationResultEventEmitter?.unsubscribe(subscribeValidateResult);
    }

  }, [])

  return(
    <div className={clazz.outermostCtn}>
      <div className={clazz.syntaxCtn}>
        <ReactJson
            theme="monokai"
            collapsed={3}
            onSelect={doHighlightRang}
            src={astTreeRoot}
        />
      </div>
      <div className={clazz.problemCtn}>
        <pre>
          {JSON.stringify(problems, (key, value) => {
            if (key === 'node'){
              return undefined;
            }
            return value
          }, 2)}
        </pre>
      </div>
      <div className={clazz.editorCtn}>
        <MonacoEditorDiv ref={monacoEditorDiv}/>
      </div>
    </div>
  )
})

export default DummyEditor;
