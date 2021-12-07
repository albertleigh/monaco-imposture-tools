const EXPRESSION_EDITOR_ID = 'first-expression-monaco-editor'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clearPageErrors(page){
  return await page.evaluate(()=>{
    (function () {
      console.stderrlog = undefined;
    })();
  })
}

async function seizePageErrors(page){
  return await page.evaluate(()=>{
    if (Array.isArray(console.stderrlog)){
      return console.stderrlog.join('\r\n')
    }
    return '';
  })
}

async function seizeCurExpTxt(page){
  return await page.evaluate(()=>{
    return window.expCodeDocumentText.trim();
  })
}


async function seizeCurExpProb(page){
  const probStr = await page.evaluate(()=>{
    return JSON.stringify(window.expProblems, ((key, value) => {
      if (key === 'node'){
        return undefined;
      }
      return value;
    }));
  })
  return JSON.parse(probStr).filter(one => one.severity === 8);
}

async function seizeCurExpWarnings(page){
  const probStr = await page.evaluate(()=>{
    return JSON.stringify(window.expProblems, ((key, value) => {
      if (key === 'node'){
        return undefined;
      }
      return value;
    }));
  })
  return JSON.parse(probStr).filter(one => one.severity === 4);
}

async function seizeCurExpHints(page){
  const probStr = await page.evaluate(()=>{
    return JSON.stringify(window.expProblems, ((key, value) => {
      if (key === 'node'){
        return undefined;
      }
      return value;
    }));
  })
  return JSON.parse(probStr).filter(one => one.severity === 1);
}

async function clearUpMonacoEditor(page){
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');

  await page.keyboard.press('Delete');
}

async function typeInMonacoEditor(page, editorId, str){
  await page.type(`#${editorId} textarea`, str);
  await delay(750);
}

async function hoverOneSpanContaining(page, content){
  const allSpanElements = await page.$$('span');
  for (const oneSpan of allSpanElements){
    const contains = await page.evaluate((ele, str)=> (
      ele.textContent === str
    ), oneSpan, content)
    if (!!contains){
      await oneSpan.hover();
      await delay(750);
      break;
    }
  }
}

async function collectMonacoListRowsAriaLabels(page){
  const allCompletionListEle = await page.$$('.monaco-list-rows .monaco-list-row')
  const allCompletionList = [];
  for (const oneCompletionHandler of allCompletionListEle){
    const ariaLabel = await page.evaluate(el => el.getAttribute("aria-label"), oneCompletionHandler);
    allCompletionList.push(ariaLabel);
  }
  return allCompletionList;
}

async function triggerCompletionOfCurrentCursor(page){
  // trigger ctrl + space
  await page.keyboard.down('Control');
  await page.keyboard.press('Space');
  await page.keyboard.up('Control');
  await delay(250);
}

module.exports = {
  EXPRESSION_EDITOR_ID,
  delay,
  clearPageErrors,
  seizePageErrors,
  typeInMonacoEditor,
  clearUpMonacoEditor,
  hoverOneSpanContaining,
  collectMonacoListRowsAriaLabels,
  triggerCompletionOfCurrentCursor,
  seizeCurExpTxt,
  seizeCurExpProb,
  seizeCurExpWarnings,
  seizeCurExpHints
}
