<h1 align="center">Azure logic app language</h1>

<div align="center">
An azure logic app language package for monaco editor.  
[![npm version](https://img.shields.io/npm/v/monaco-azure-logic-app-lang.svg)](https://www.npmjs.com/package/monaco-azure-logic-app-lang)
</div>

> *This is a very early release of the package, do not suggest using it in production till latter stable version*

A simple example explains the purpose of this package: 
```tsx
import React, {forwardRef, memo, RefObject, useRef, useEffect, ForwardedRef} from 'react';

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {
  default as AzLogicAppExpressionLang, AzLogicAppExpressionLangMonacoEditor
} from "monaco-azure-logic-app-lang";

AzLogicAppExpressionLang.scannerOrItsPath = `assets/scanner.wasm`;
AzLogicAppExpressionLang.monaco = monaco;

const sampleCodes = "@concat(pipeline().DataFactory, pipeline().GroupId)";
const MONACO_EDITOR_ID = 'first-az-lgc-app-editor';

const MonacoEditorDiv = memo<{ref:RefObject<HTMLDivElement>}>(forwardRef((props, ref: ForwardedRef<HTMLDivElement>)=>{
  return<div id={MONACO_EDITOR_ID} style={{height: "100%"}} ref={ref}/>
}) as any)


export const FirstAzLgcAppEditor:React.FC = React.memo(function DummyEditor() {

  const monacoEditorDiv = useRef<HTMLDivElement>(null);
  const monacoEditor = useRef<{
    editor?:  AzLogicAppExpressionLangMonacoEditor
    element?: HTMLDivElement
  }>({})

  useEffect(()=>{
    if (monacoEditorDiv.current){
      monacoEditor.current.element = monacoEditorDiv.current;
      monacoEditor.current.editor = new AzLogicAppExpressionLangMonacoEditor(
        monacoEditor.current.element,
        {
          theme: 'vs-dark',
          contextmenu: false,
          value: sampleCodes,
          automaticLayout: true,
        },
        MONACO_EDITOR_ID
      )
    }
  }, [])

  return(
    <div style={{
      width: '100vw',
      height: '100vh'
    }}>
      <MonacoEditorDiv ref={monacoEditorDiv}/>
    </div>
  )
})

export default FirstAzLgcAppEditor;
```