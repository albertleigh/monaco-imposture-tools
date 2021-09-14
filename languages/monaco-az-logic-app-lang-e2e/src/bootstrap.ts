import {
  MONACO_EDITOR_ID as EXPRESSION_MONACO_EDITOR_ID,
  mount as mountExpressionEditor
} from './editors/ExpressionEditor';

const rootEle = document.getElementById('root');
if (rootEle){

  // init expression editor
  const expressionEditorEle = document.createElement('div');
  expressionEditorEle.id = EXPRESSION_MONACO_EDITOR_ID
  expressionEditorEle.style.height = '100vh';
  expressionEditorEle.style.width = '100vw';
  rootEle.appendChild(expressionEditorEle);
  mountExpressionEditor(expressionEditorEle);

}else{
  throw new Error(`The DOM element of the id root was not found.`)
}
