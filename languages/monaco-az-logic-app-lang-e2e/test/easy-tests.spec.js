const chai = require('chai');
const expect = chai.expect;
const puppeteer = require('puppeteer');

const {delay, typeInMonacoEditor, EXPRESSION_EDITOR_ID, hoverOneSpanContaining, collectMonacoListRowsAriaLabels,
  seizeCurExpTxt, seizeCurExpProb,
  clearUpMonacoEditor, triggerCompletionOfCurrentCursor
} = require('./utils');

const IS_CI = process.env.CI === 'true';


describe('e2e easy test', () => {
  it('dummy test', async () => {
    const browser = await puppeteer.launch({
      headless: IS_CI, slowMo: 50, devtools:!IS_CI,
      args:[
        '--window-size=1440,900',
      ]
    });
    const page = await browser.newPage();

    await page.goto('http://localhost:3002');

    await delay(3000);

    await clearUpMonacoEditor(page);

    // #first-dummy-monaco-editor>.monaco-editor

    await clearUpMonacoEditor(page);

    let nextText, content, problems, allCompletionList;
    await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, '@{add');

    // await page.keyboard.press('ArrowLeft');
    // trigger ctrl + space
    await triggerCompletionOfCurrentCursor(page);

    allCompletionList = await collectMonacoListRowsAriaLabels(page);
    expect(allCompletionList.length>0).ok;
  });
});