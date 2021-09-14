<h1 align="center">Azure logic app language</h1>

<div align="center">

An azure logic app language module for monaco editor.

[![npm version](https://img.shields.io/npm/v/monaco-azure-logic-app-lang.svg)](https://www.npmjs.com/package/monaco-azure-logic-app-lang)
[![Build Status](https://app.travis-ci.com/albertleigh/monaco-imposture-tools.svg?branch=main)](https://travis-ci.com/albertleigh/monaco-imposture-tools)
[![Coverage Status](https://coveralls.io/repos/github/albertleigh/monaco-imposture-tools/badge.svg)](https://coveralls.io/github/albertleigh/monaco-imposture-tools)
![Code style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)
</div>

> *This is a very early release, do not suggest using it in production till latter its stable version*

A simple example explains the purpose of this module: 
```typescript
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {
  default as AzLogicAppExpressionLang,
  IdentifierType,
  AzLgcExpDocument,
  AzLogicAppExpressionLangMonacoEditor,
  ValidateResult
} from 'monaco-azure-logic-app-lang';
import scannerPath from 'monaco-azure-logic-app-lang/scanner/scanner.wasm';

AzLogicAppExpressionLang.scannerOrItsPath = scannerPath;
AzLogicAppExpressionLang.monaco = monaco;
// AzLogicAppExpressionLang.emitBinaryTokens = true;
// AzLogicAppExpressionLang.inSyntaxDebugMode = true;
// AzLogicAppExpressionLang.inSemanticDebugMode = true;

const sampleCodes = "";

export const MONACO_EDITOR_ID = 'first-expression-monaco-editor';

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
  const theEditor = new AzLogicAppExpressionLangMonacoEditor(
    root,
    {
      theme: 'hc-black',
      contextmenu: false,
      value: sampleCodes,
      automaticLayout: true,
    },
    MONACO_EDITOR_ID
  )
  AzLogicAppExpressionLangMonacoEditor.init.then(()=>{
    theEditor.azLgcExpDocEventEmitter?.subscribe(subscribeCodeDoc);
    theEditor.validationResultEventEmitter?.subscribe(subscribeValidateResult);
  })
}

const rootEle = document.getElementById('root');

if (rootEle){
  const expressionEditorEle = document.createElement('div');
  expressionEditorEle.id = EXPRESSION_MONACO_EDITOR_ID
  expressionEditorEle.style.height = '100vh';
  expressionEditorEle.style.width = '100vw';
  rootEle.appendChild(expressionEditorEle);
  mount(expressionEditorEle);
}

```