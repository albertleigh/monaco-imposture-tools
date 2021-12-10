const os = require('os');
const chai = require('chai');
const expect = chai.expect;
const puppeteer = require('puppeteer');

const {delay, typeInMonacoEditor, EXPRESSION_EDITOR_ID, hoverOneSpanContaining, collectMonacoListRowsAriaLabels,
  seizeCurExpTxt, seizeCurExpProb, seizeCurExpWarnings, seizeCurExpHints,
  clearUpMonacoEditor, triggerCompletionOfCurrentCursor, seizeCurExpAllProb
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

    let nextText, content, problems, warnings, hints, allCompletionList;

    nextText = `@activity('Get Default 1')`;

    await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

    await delay(250);

    problems = await seizeCurExpProb(page);
    expect(problems.length).eq(0);

    await triggerCompletionOfCurrentCursor(page);

    await delay(250);

    allCompletionList = await collectMonacoListRowsAriaLabels(page);
    expect(allCompletionList.length>=1).ok;

    expect(allCompletionList.some(value =>
      value.indexOf('structure') > -1
    )).not.ok;

    await page.keyboard.press('Enter');

    await delay(250);

    content = await seizeCurExpTxt(page);
    problems = await seizeCurExpAllProb(page);
    expect(content).eq("@activity('Get Default 1').output");
    expect(problems.length).eq(0);

  });
});
