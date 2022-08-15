const os = require('os');
const chai = require('chai');
const expect = chai.expect;
const puppeteer = require('puppeteer');

const {delay, typeInMonacoEditor, EXPRESSION_EDITOR_ID, hoverOneSpanContaining, collectMonacoListRowsAriaLabels,
  seizeCurExpTxt, seizeCurExpProb, seizeCurExpWarnings, seizeCurExpHints,
  clearUpMonacoEditor, triggerCompletionOfCurrentCursor, seizeCurExpAllProb, clearPageErrors, seizePageErrors,
  manuallySetModelText
} = require('./utils');

const IS_CI = process.env.CI === 'true';


describe('e2e easy test', () => {
  it.only('dummy test', async () => {
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

    let nextText, content, problems, warnings, hints, allCompletionList, hoverRows;

    nextText =
        `@activity('Get Default 1').output[
    string(1), string(1)
`;

    await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

    content = await seizeCurExpTxt(page);
    problems = await seizeCurExpProb(page);
    expect(content).ok;
    expect(problems.length).eq(1);
    // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
    // Cannot fit package::**Return package pipeline** into the function parameter string list item.
    expect(problems[0].code).eq(16);
    expect(problems[0].startPos.line).eq(0);
    expect(problems[0].startPos.character).greaterThanOrEqual(33);
    expect(problems[0].endPos.line).eq(3);
    expect(problems[0].endPos.character).lessThanOrEqual(1);

  }).timeout(0);


  describe('Bunch of valid expressions', ()=>{

    let browser;
    let page;

    before(async() => {
      browser = await puppeteer.launch({
        headless: IS_CI, slowMo: 50, devtools:!IS_CI,
        args:[
          '--window-size=1440,900',
        ]
      });
      page = await browser.newPage();

      await page.goto('http://localhost:3002');

      await delay(3000);
    });

    after(async ()=>{
      page.close();
    });

    beforeEach(async ()=>{
      await clearUpMonacoEditor(page);
      await clearPageErrors(page);
    });

    afterEach(async()=>{
      const pageErrorsStr = await seizePageErrors(page);
      expect(pageErrorsStr).not.ok;
    });


    [
      "@concat(\'Hello\', \'World\')",
      // "@concat('\\')",
      // "@concat('\\',concat(''''))",
      "@concat('azfunc-out',concat('CompanyID'))",
      // "@concat('azfunc-out','\\',concat('CompanyID'))",
      // "    @concat('Hello', 'World')",
      "@substring('somevalue-foo-somevalue',10,3)",
      "@substring('hello', 1, sub(3, 1))",
      "@replace('the old string', 'old', 'new')",
      // "@replace('replace functions\\s escape char test ', '\\', '''')",
      "@guid('P')",
      "@toLower('Two by Two is Four')",
      "@toUpper('Two by Two is Four')",
      "@indexof('hello, world.', 'world')",
      "@startswith('hello, world', 'hello')",
      "@endsWith('hello world', 'world')",
      "@split('a;b;c',';')",
      "@intersection([1, 2, 3], [101, 2, 1, 10],[6, 8, 1, 2])",
      "@union([1, 2, 3], [101, 2, 1, 10])",
      "@first([0,2,3])",
      "@last([0,2,3])",
      "@take([1, 2, 3, 4], 2)",
      "@skip([1, 2 ,3 ,4], 2)",
      "@equals('foo', 'foo')",
      "@less(10,100)",
      "@lessOrEquals(10,10)",
      "@greater(10,10)",
      "@and(greater(1,10),equals(0,0))",
      "@or(greater(1,10),equals(0,0))",
      "@not(contains('200 Success','Fail'))",
      "@if(equals(1, 1), 'yes', 'no')",
      "@float('10.333')",
      "@bool(0)",
      "@coalesce(null, 'hello', 'world')",
      "@base64('some string')",
      "@base64ToString('c29tZSBzdHJpbmc=')",
      "@binary('some string')",
      "@dataUriToBinary('data:;base64,c29tZSBzdHJpbmc=')",
      "@dataUriToString('data:;base64,c29tZSBzdHJpbmc=')",
      "@dataUri('some string')",
      "@decodeBase64('c29tZSBzdHJpbmc=')",
      "@encodeUriComponent('You Are:Cool/Awesome')",
      "@decodeUriComponent('You+Are%3ACool%2FAwesome')",
      "@decodeDataUri('data:;base64,c29tZSBzdHJpbmc=')",
      "@uriComponent('You Are:Cool/Awesome ')",
      "@uriComponent('https://contoso.com')",
      "@uriComponentToBinary('You+Are%3ACool%2FAwesome')",
      "@uriComponentToString('You+Are%3ACool%2FAwesome')",
      "@xml('<name>Alan</name>')",
      "@xpath(xml('<?xml version=\"1.0\"?> <produce> <item> <name>Gala</name> <type>apple</type> <count>20</count> </item> <item> <name>Honeycrisp</name> <type>apple</type> <count>10</count> </item> </produce>'), '/produce/item/name')",
      "@array('abc')",
      "@createArray('a', 'c')",
      "@add(10,10.333)",
      "@add(10,10)",
      "@sub(10,10.333)",
      "@sub(10,10)",
      "@mul(10,10.333)",
      "@mul(10,10)",
      "@div(10,10.333)",
      "@div(10,10)",
      "@mod(10,4)",
      "@min(0,1,2)",
      "@min(0,1,2.0)",
      "@max(0,1,2)",
      "@max(0,1,2.0)",
      "@range(3,4)",
      "@rand(-1000,1000)",
      "@utcnow()",
      "@addseconds('2015-03-15T13:27:36Z', -36)",
      "@addminutes('2015-03-15T13:27:36Z', 33)",
      "@addhours('2015-03-15T13:27:36Z', 12)",
      "@adddays('2015-03-15T13:27:36Z', -20)",
      "@formatDateTime('03/15/2018 12:00:00', 'yyyy-MM-ddTHH:mm:ss')",
    ].forEach((value, index)=>{
      it(`Valid expression ${index + 103}`, async ()=>{
        let nextText, content, problems;

        nextText = value

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
      })
    });

    [
      "@indexOf('hello, world.', 'world')",
      "@endswith('hello world', 'world')",
      "@utcNow()",
      "@addSeconds('2015-03-15T13:27:36Z', -36)",
      "@addMinutes('2015-03-15T13:27:36Z', 33)",
      "@addHours('2015-03-15T13:27:36Z', 12)",
      "@addDays('2015-03-15T13:27:36Z', -20)",
    ].forEach((value, index)=>{
      it(`Strict Valid expression ${index + 192}`, async ()=>{
        let nextText, content, problems;

        nextText = value

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
      })
    });

  })

});
