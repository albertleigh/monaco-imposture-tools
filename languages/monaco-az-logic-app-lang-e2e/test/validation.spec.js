const chai = require('chai');
const expect = chai.expect;
const {
  EXPRESSION_EDITOR_ID, typeInMonacoEditor,clearUpMonacoEditor,
  triggerCompletionOfCurrentCursor, seizeCurExpTxt, seizeCurExpProb, delay, clearPageErrors, seizePageErrors,
  seizeCurExpWarnings, seizeCurExpHints, seizeCurExpAllProb, manuallySetModelText
} = require("./utils");

function generateValidationTests(openOnePage, closeOnePage) {
  describe('validation test cases', ()=>{

    let page;

    before(async() => {
      page = await openOnePage();
    })

    after(async ()=>{
      closeOnePage(page)
    })

    beforeEach(async ()=>{
      await clearUpMonacoEditor(page);
      await clearPageErrors(page);
    })

    afterEach(async()=>{
      const pageErrorsStr = await seizePageErrors(page);
      expect(pageErrorsStr).not.ok;
    })

    describe('Bunch of valid expressions', ()=>{
      [
`{
    "@()": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "0076D7",
    "summary": "Pipeline run result",
    "@summary2": "@min",
    "sections": [
    ],
    "potentialAction": [
    ]
}`,
`{
    "@(min(pipeline().globalParameters.oneTypedObj.anotherGlobalFloat,activity('Lookup 3').output.firstRow.count))": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "0076D7",
    "summary": "Pipeline run result",
    "@summary2": "@min",
    "sections": [
    ],
    "potentialAction": [
    ]
}`,
`{
    "@(min(fwefw wefwef piwefwepeline().globalParameters.oneTypedObj.anotherGlobalFloat,activity('Lookup 3').output.firstRow.count))": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "0076D7",
    "summary": "Pipeline run result",
    "@summary2": "@min",
    "sections": [
    ],
    "potentialAction": [
    ]
}`,
`{
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "0076D7",
    "summary": "Pipeline run result",
    "@summary2": "@min",
    "sections": [
        {
            "activityTitle": "ADF MSAL Usage Query Result​​​​",
            "facts": [
                {
                    "name": "Pipeline run result",
                    "value": "@{pipeline().globalParameters.firstGlobalStrPara}"
                },
                {
                    "name": "Notification time (UTC):",
                    "value": "@{utcNow()}"
                }
            ],
            "markdown": true
        }
    ],
    "potentialAction": [
    ]
}`,
        "@concat('\\')",
        "@concat('\\\\')",
        "@concat('\\\\',concat(''''))",
        "@concat('azfunc-out','\\\\',concat('CompanyID'))",
        "    @concat('Hello', 'World')",
        "@replace('replace functions\\s escape char test ', '\\', '''')",
      ].forEach((value, index)=>{
        it(`Manually input valid expression ${index}`, async ()=>{
          let nextText, content, problems;

          nextText = value

          await manuallySetModelText(page, nextText);

          content = await seizeCurExpTxt(page);
          problems = await seizeCurExpProb(page);
          expect(content).eq(nextText.trim());
          expect(problems.length).eq(0);

          await manuallySetModelText(page, "");
        })
      });

    [
`@json('{
    "str": "another",
    "num": 2,
    "bool": true,
    "null": null,
}')`,
`@json('{
    "str": "another",
    "num": 2,
    "bool": true,
    "null": null
}')`,
"@{(}",
    ].forEach((value, index)=>{
        it(`Strict manually input valid expression ${index}`, async ()=>{
          let nextText, content, problems;

          nextText = value

          await manuallySetModelText(page, nextText);

          content = await seizeCurExpTxt(page);
          problems = await seizeCurExpAllProb(page);
          expect(content).eq(nextText.trim());
          expect(problems.length).eq(0);

          await manuallySetModelText(page, "");
        })
      });

      [
        '@addHours(utcNow(),-5)',
        '@take([string(1), string(1)], 2)',
        "@activity('Get Default 1').output2fewfwelf",
        "@activity('Get Default 1').output[string(1)]",
        "@pipeline()['TriggeredByPipelineName']",
        "@activity('Get Default 1').output[string(1)]",
        "@pipeline()['DataFactory']",
        "@activity('Get Default 1').output.childItems[0].name",
        "@item().one.two.three",
        "@item()?.one.two.three",
        "@item().one?.two.three",
        "@item().one.two?.three",
        "@item()?.one?.two.three",
        "@item().one?.two?.three",
        "@item()?.one?.two?.three",
        "@item().one['two'].three",
        "@contains( [pipeline().DataFactory], [pipeline().GroupId] )",
        "@pipeline().globalParameters?.firstGlobalStrPara",
        "@pipeline().optionalPackage?.oneOptionalString",
        "@pipeline()?.TriggeredByPipelineName",
        "@piPeline()?.optionalpackage?.oneOptionalString",
        "@piPeline()['optionalpackage']?.oneoptionalString",
        "@contains(json(item().DataLoadingBehaviorSettings).watermarkColumnType, 'Int')",
        "@contains(json(item().DataLoadingBehaviorSettings).watermarkColumnType, [])",
        "@concat('Baba', '''s ', 'book store')",
        "@if(contains(json(item().DataLoadingBehaviorSettings).watermarkColumnType, 'Int'),'','''')",
        "@equals(pipeline().globalParameters.firstGlobalStrPara,  '0')",
        "@array('abc', 'defg')",
        "@union([1, 2, 3], [101, 2, 1, 10])",
        "@min(pipeline().globalParameters.oneTypedObj.anotherGlobalFloat,activity('Lookup 3').output.firstRow.count)",
        "@max(pipeline().globalParameters.oneTypedObj.anotherGlobalNumber,activity('Lookup 4').output.firstRow.count)",
        "@coalesce(1,2,'',true, false, xml(''))",
        "@createArray(1,2,'',true, false, json(''))",
        "@float('0.777')",
        "@subtractFromTime('',1, string( json('')))",
        "@subtractFromTime('',1, string( json('')), 'another')",
        "@concat(\'Hello\', \'World\')",
        "@concat('azfunc-out',concat('CompanyID'))",
        "@substring('somevalue-foo-somevalue',10,3)",
        "@substring('hello', 1, sub(3, 1))",
        "@replace('the old string', 'old', 'new')",
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
        it(`Valid expression ${index}`, async ()=>{
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
        '@activity(\'Get Default 1\').output.value[2].whatever.again.another',
        '@activity(\'Get Default 1\').anyOutput.value[2].whatever.again.another',
        '@activity(\'Get Default 1\').output.value[add(1, 1)].whatever.again.another',
        '@activity(\'GetFileMetadata 1\').output.structure[add(1,2)].name',
        '@activity(\'Lookup 3\').output.value[1].anything.whatsoever',
        '@activity(\'Lookup 3\').whatever[2].and.anything.you[\'want\'][2]',
        '@activity(\'Lookup 3\').whatever[2].and[266].anything.you[\'want\'][2]',
        "@indexOf('hello, world.', 'world')",
        "@endswith('hello world', 'world')",
        "@utcNow()",
        "@addSeconds('2015-03-15T13:27:36Z', -36)",
        "@addMinutes('2015-03-15T13:27:36Z', 33)",
        "@addHours('2015-03-15T13:27:36Z', 12)",
        "@addDays('2015-03-15T13:27:36Z', -20)",
        "@contains( variables('splitStates'), variables('stateItem'))",
        "@{addDays(utcNow(), 1)}",
        "@activity(activity('GetFileMetadata 1').output.itemType)",
        "@activity(activity('Lookup 3').output.value[0])",
        "@activity(activity('Lookup 1 first row only').output.firstRow)",
        "@concat(split('one\t\ttwo\tthree', '\t'))",
        "@concat(activity('Lookup 1 first row only'))",
        "@concat(createArray(activity('Lookup 3').output.value))",
        "@concat('str1')",
        "@concat('str1', 'str2')",
        "@concat(activity('Get Default 1'))",
        "@add(1, 2)",
        "@less(1, null)",
        "@if( true, 'trueVal', 'falseVal')",
        "@concat(activity('Lookup 1 first row only').output)",
        "@pipeline().globalParameters.oneTypedObj?['anotherGlobalArr']",
        "@pipeline().globalParameters.oneTypedObj?[item().checkpointName]",
      ].forEach((value, index)=>{
        it(`Strict Valid expression ${index}`, async ()=>{
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

    describe('Handle the dynamic value descriptor', ()=>{
      it('@dynamic# v1', async ()=>{
        let nextText, content, problems, warnings;

        nextText = '@dynamic';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        expect(content).eq('@dynamic1(1)');
        expect(problems.length).eq(0);
        expect(warnings.length).eq(0);

        await page.evaluate(() => {
          window.regenerateNextSymbolTable();
        })

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq('@dynamic1(1)');
        expect(problems.length).eq(1);

        expect(problems[0].code).eq(4);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(12);

        await clearUpMonacoEditor(page);

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        expect(content).eq('@dynamic2(2)');
        expect(problems.length).eq(0);
        expect(warnings.length).eq(0);
      })
    })

    describe('Handle any object flawlessly', ()=>{

      it('regular identifiers v1', async ()=>{
        let nextText, content, problems, warnings;
        nextText = '@item()';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
        expect(warnings.length).eq(0);

      })

      it('regular identifiers v2', async ()=>{
        let nextText, content, problems, warnings;
        nextText = '@item().one';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
        expect(warnings.length).eq(0);

      })

      it('regular identifiers v3', async ()=>{
        let nextText, content, problems, warnings;
        nextText = '@item().one.two.three';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
        expect(warnings.length).eq(0);

      })

      it('bracket identifiers v1', async ()=>{
        let nextText, content, problems, warnings;
        nextText = "@item()['one']";
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
        expect(warnings.length).eq(0);

      })

      it('bracket identifiers v2', async ()=>{
        let nextText, content, problems, warnings;
        nextText = "@item()['one']['two']";
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
        expect(warnings.length).eq(0);

      })

      it('bracket identifiers v3', async ()=>{
        let nextText, content, problems, warnings;
        nextText = "@item().one['two'].three";
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
        expect(warnings.length).eq(0);
      })

    })

    describe('NEED_PRECEDING_SEPARATOR 0x02', ()=>{
      it('need a preceding comma in a function parameter expression', async ()=>{
        const nextText = '@add(1 233)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Miss a preceding comma
        expect(problems[0].code).eq(2);
        expect(problems[0].message.indexOf('comma')).greaterThan(-1);

        // todo test quick fix and its positions

      })
    })

    describe('INVALID_FUNCTION_PATTERN 0x03', ()=>{

      it('One valid function call', async ()=>{
        //@add(3, 4)
        const nextText = '@add(3, 4)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
      })

      it('Regard the function call at root statement as string', async ()=>{
        const nextText = 'add(1, 233)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
        // Miss a preceding @ for the function call at root statement
        // expect(problems[0].code).eq(3);
        // expect(problems[0].message.indexOf('@')).greaterThan(-1);
      })

      it('Invalid function pattern type 01', async ()=>{
        const nextText = '@add(1, 233)(3,4)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Miss a preceding @ for the function call at root statement
        expect(problems[0].code).eq(3);
        expect(problems[0].startPos.character).eq(0);
        expect(problems[0].endPos.character).eq(17);
      })
    })

    describe('UNKNOWN_FUNCTION_NAME 0x04', ()=>{
      it('found unrecognized a function name:: root level', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = '@add2(1, 233)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Unknown function name
        expect(problems[0].code).eq(4);
        expect(problems[0].startPos.character).eq(0);
        expect(problems[0].endPos.character).eq(13);
      })

      it('found unrecognized a function name:: expression level', async ()=>{
        const nextText = '@add(1, add2(2, 3))';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Unknown function name
        expect(problems[0].code).eq(4);
        expect(problems[0].startPos.character).eq(8);
        expect(problems[0].endPos.character).eq(18);
      })
    })

    describe('FUNCTION_PARAMETER_COUNT_MISMATCHES 0x05', ()=>{

      it('empty parentheses for a function of parameters required', async ()=>{
        const nextText = '@add()';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // The function call lacked or had more parameters required
        expect(problems[0].code).eq(5);
        expect(problems[0].startPos.character).eq(0);
        expect(problems[0].endPos.character).eq(6);
      })

      it('only show a comma for a function of parameters required', async ()=>{
        const nextText = '@add(, )';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // The function call lacked or had more parameters required
        expect(problems[0].code).eq(5);
        expect(problems[0].startPos.character).eq(0);
        expect(problems[0].endPos.character).eq(8);
      })

      it('fill in a function concat of variable parameter list v1', async ()=>{
        let nextText, content, problems;

        nextText = '@concat';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        await triggerCompletionOfCurrentCursor(page, EXPRESSION_EDITOR_ID, nextText);
        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq('@concat()');
        expect(problems.length).eq(0);

        //move to @concat(|

        await page.keyboard.press('ArrowLeft');
        await triggerCompletionOfCurrentCursor(page);
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, 'pipe');
        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq('@concat(pipeline().DataFactory)');
        expect(problems.length).eq(0);

        // @concat(pipeline().DataFactory, |)
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, ', ');
        await triggerCompletionOfCurrentCursor(page);
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, 'pipe');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq('@concat(pipeline().DataFactory, pipeline().globalParameters.firstGlobalStrPara)');

        expect(problems.length).eq(0);

      })

      it('The function call lacked or had more parameters required:: root level 1#', async ()=>{
        const nextText = '@add(1, 2, 3)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // The function call lacked or had more parameters required
        expect(problems[0].code).eq(5);
        expect(problems[0].startPos.character).eq(0);
        expect(problems[0].endPos.character).eq(13);
      })

      it('The function call lacked or had more parameters required:: root level 2#', async ()=>{
        const nextText = '@guid(10,10,10)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // The function call lacked or had more parameters required
        expect(problems[0].code).eq(5);
        expect(problems[0].startPos.character).eq(0);
        expect(problems[0].endPos.character).eq(15);
      })

      it('The function call lacked or had more parameters required:: root level 3#', async ()=>{
        const nextText = '@toLower()';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // The function call lacked or had more parameters required
        expect(problems[0].code).eq(5);
        expect(problems[0].startPos.character).eq(0);
        expect(problems[0].endPos.character).eq(10);
      })

      it('The function call lacked or had more parameters required:: root level 4#', async ()=>{
        const nextText = '@replace(1,2)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // The function call lacked or had more parameters required
        expect(problems[0].code).eq(5);
        expect(problems[0].startPos.character).eq(0);
        expect(problems[0].endPos.character).eq(13);
      })

      it('The function call lacked or had more parameters required:: expression level', async ()=>{
        const nextText = '@add(1, add( 2, 3, 4) )';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // The function call lacked or had more parameters required
        expect(problems[0].code).eq(5);
        expect(problems[0].startPos.character).eq(8);
        expect(problems[0].endPos.character).eq(21);
      })
    })

    describe('FUNCTION_PARAMETER_TYPE_MISMATCHES 0x06', ()=>{

      it ('cannot fit string into number', async()=>{
        let nextText, content, problems;
        nextText = '@add(1, \'2\')';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Unknown function name
        expect(problems[0].code).eq(6);
        expect(problems[0].startPos.character).greaterThanOrEqual(7);
        expect(problems[0].endPos.character).lessThanOrEqual(11);

        await clearUpMonacoEditor(page);

        nextText = '@add(1, 2)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
      })

      it ('cannot fit number into string', async()=>{
        let nextText, content, problems;
        nextText = '@concat(\'1\', 2 )';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Cannot fit number into the function parameter string list item.
        expect(problems[0].code).eq(6);
        expect(problems[0].startPos.character).greaterThanOrEqual(12);
        expect(problems[0].endPos.character).lessThanOrEqual(15);

        await clearUpMonacoEditor(page);

        nextText = '@concat(\'1\', \'2\' )';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
      })

      it ('Simple overloaded function', async()=>{
        let nextText, content, problems;
        nextText = '@take([], 2 )';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);

        await clearUpMonacoEditor(page);

        nextText = '@take([1,2,3], 2 )';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);

        await clearUpMonacoEditor(page);

        nextText = "@take('onestring', 2 )";
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);

        await clearUpMonacoEditor(page);

        nextText = '@take( null , 2 )';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Cannot fit null into the function parameter array.
        expect(problems[0].code).eq(6);
        expect(problems[0].startPos.character).greaterThanOrEqual(6);
        expect(problems[0].endPos.character).lessThanOrEqual(13);
      })

    })

    describe('INVALID_IDENTIFIER 0x07 0x08 0x09', ()=>{
      it('invalid identifier chain 1#', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = '@pipeline().DataFactory2';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Unrecognized identifiers of the function result
        expect(problems[0].code).eq(9);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(11);
        expect(problems[0].endPos.character).lessThanOrEqual(24);
      })

      it('invalid identifier chain 2#', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = 'string @{interpolation}';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Unrecognized identifiers of the function result
        expect(problems[0].code).eq(8);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(9);
        expect(problems[0].endPos.character).lessThanOrEqual(22);
      })

      it('valid identifier chain 2# w/o function call: incomplete function call', async ()=>{

        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = '@pipeline.DataFactory2';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);

      })
    })

    describe('INVALID_MULTIPLE_EXPRESSION 0x0a', ()=>{

      it('multiple expressions beneath root :: functional call', async ()=>{
        const nextText = '@add(1,2),@add(3,4)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Cannot have multiple identifiers within the root statement
        expect(problems[0].code).eq(10);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(10);
        expect(problems[0].endPos.character).lessThanOrEqual(19);
      })

      it('multiple expressions beneath curly brackets :: functional call', async ()=>{
        const nextText = '@{add(1, 2),add(3, 4)}';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Cannot have multiple identifiers within the curly brackets
        expect(problems[0].code).eq(10);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(12);
        expect(problems[0].endPos.character).lessThanOrEqual(21);
      })

      // it('multiple expressions beneath root :: identifier', async ()=>{
      //
      // })
      //
      // it('multiple expressions beneath curly brackets :: identifier', async ()=>{
      //
      // })

    })

    describe('INVALID_TEMPLATE 0x0b', ()=>{

      it('One valid template', async ()=>{
        //@{add(1,2)}@{add(1,2)}
        const nextText = '@{add(1,2)}';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
      })

      it('Multiple valid templates', async ()=>{
        //@{add(1,2)}@{add(1,2)}
        const nextText = '@{add(1,2)}@{add(1,2)}';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
      })

      it('A valid template among non-token str', async ()=>{
        //non-tkn01@{add(1,2)}non-tkn02@{add(1,2)}non-tkn03 123 456e3
        const nextText = 'non-tkn01@{add(1,2)}non-tkn02@{add(1,2)}non-tkn03 123 456e3';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
      })


      it('A string template cannot succeed an identifier within the root statement', async ()=>{
        const nextText = '@add(3, 4)@{add(1,2)}';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // A string template cannot succeed an identifier within the root statement
        expect(problems[0].code).eq(11);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(10);
        expect(problems[0].endPos.character).lessThanOrEqual(21);
      })
    })

    // todo add this suite
    // describe('INVALID_NESTED_TEMPLATE 0x0c', ()=>{
    //   it('A template cannot nest each other', async ()=>{
    //     const nextText = '@{@{add(1,2)}}';
    //     await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
    //
    //     const content = await seizeCurExpTxt(page);
    //     const problems = await seizeCurExpProb(page);
    //     expect(content).eq(nextText);
    //     expect(problems.length).eq(1);
    //     // A string template cannot succeed an identifier within the root statement
    //     expect(problems[0].code).eq(12);
    //     expect(problems[0].startPos.line).eq(0);
    //     expect(problems[0].endPos.line).eq(0);
    //     expect(problems[0].startPos.character).greaterThanOrEqual(10);
    //     expect(problems[0].endPos.character).lessThanOrEqual(21);
    //   })
    // })

    describe('NON_FULL_ROOT_FUN_CALL_EXP 0x0d', ()=>{

      it('incomplete root function call expression v1', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = '@concat(';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        await delay(250);

        await page.keyboard.press('End');
        await page.keyboard.press('Backspace');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(2);
        // The function call must take the completion string
        expect(problems[0].code).eq(13);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(0);
        expect(problems[0].endPos.character).lessThanOrEqual(0);

        expect(problems[1].code).eq(20);
        expect(problems[1].startPos.line).eq(0);
        expect(problems[1].endPos.line).eq(0);
        expect(problems[1].startPos.character).greaterThanOrEqual(1);
        expect(problems[1].endPos.character).lessThanOrEqual(8);
      })

      it('expression shown after a template', async ()=>{
        const nextText = '@{add(1,2)}@add(3,4)';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // The function call must take the completion string
        expect(problems[0].code).eq(13);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(11);
        expect(problems[0].endPos.character).lessThanOrEqual(20);
      })

      it('One template, one function call and another template', async ()=>{
        const nextText = '@{add(1,2)}@add(3, 4)@{add(5,6)}';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);

        let theProblem = problems[0];
        // // The function call must take the completion string
        // expect(theProblem.code).eq(13);
        // expect(theProblem.startPos.line).eq(0);
        // expect(theProblem.endPos.line).eq(0);
        // expect(theProblem.startPos.character).greaterThanOrEqual(11);
        // expect(theProblem.endPos.character).lessThanOrEqual(32);
        //
        // theProblem = problems[1];
        // A string template cannot succeed an identifier within the root statement
        expect(theProblem.code).eq(11);
        expect(theProblem.startPos.line).eq(0);
        expect(theProblem.endPos.line).eq(0);
        expect(theProblem.startPos.character).greaterThanOrEqual(21);
        expect(theProblem.endPos.character).lessThanOrEqual(32);
      })

    })

    describe('INVALID_STANDALONE_ACCESSOR 0x0e', ()=>{
      it('invalid standalone accessor punctuator', async ()=>{
        const nextText = "@item().one['two'].";
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Unrecognized identifiers of the function result
        expect(problems[0].code).eq(14);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).eq(18);
        expect(problems[0].endPos.character).eq(19);
      })
    })

    describe('UNRECOGNIZED_TOKENS 0x0f', ()=>{

      it('multiline line UNRECOGNIZED_TOKENS v1', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =
          `@createArray(
  @string(
  concat('1', '2')
`;
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        // expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(15);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(13);
        expect(problems[0].endPos.line).eq(1);
        expect(problems[0].endPos.character).lessThanOrEqual(7);

      })

      it('multiline line UNRECOGNIZED_TOKENS v2', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =
          `@createArray(@string(add(
  sub(
    pipeline().globalParameters.oneGlobalFloat,
pipeline().globalParameters.oneGlobalNumber
),
pipeline().globalParameters.oneGlobalFloat
`;
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        // expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(15);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(13);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(14);

      })

      it('one line UNRECOGNIZED_TOKENS v1', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = `@createArray(@string(concat('1', '2')))`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        // expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(15);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(13);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(14);

      })

    })

    describe('INCORRECT_ITEM_SIZE_OF_BRACKET_NOTATION_IDENTIFIER 0x10', ()=>{

      it('one line INCORRECT_ITEM_SIZE_OF_BRACKET_NOTATION_IDENTIFIER v1', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = `@activity('Get Default 1').output[string(1), string(1)]`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(16);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(33);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(55);

      })

      it('one line INCORRECT_ITEM_SIZE_OF_BRACKET_NOTATION_IDENTIFIER v2', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = `@pipeline()[]`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(16);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(11);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(13);

      })

      it('one line INCORRECT_ITEM_SIZE_OF_BRACKET_NOTATION_IDENTIFIER v3', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = `@activity('Get Default 1').output[].one.two.tree`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(16);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(33);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(36);

      })

      it('multi-line INCORRECT_ITEM_SIZE_OF_BRACKET_NOTATION_IDENTIFIER v1', async ()=>{
        let nextText, content, problems, allCompletionList;

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

      })

    })

    describe('INCORRECT_FIRST_ITEM_TYPE_OF_BRACKET_NOTATION_IDENTIFIER 0x11', ()=>{

      it('one line INCORRECT_ITEM_SIZE_OF_BRACKET_NOTATION_IDENTIFIER v1', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = `@pipeline()[json('')]`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(17);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(11);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(21);

      })

      it('one line INCORRECT_ITEM_SIZE_OF_BRACKET_NOTATION_IDENTIFIER v2', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = `@pipeline()[[]]`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(17);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(11);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(15);

      })

    })

    describe('IDENTIFIER_ACCESSOR_MUST_BE_OPTIONAL 0x12', ()=>{

      it ('the accessor for an optional value also has to be optional v1', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = `@pipeline().optionalPackage.oneOptionalString`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(18);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).eq(12);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).eq(28);
      })

      it ('the accessor for an optional value also has to be optional v2', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = `@pipeline()?.optionalPackage.oneOptionalString`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(18);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).eq(13);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).eq(29);
      })

    })

    describe('Q_STRING_DOUBLE_IS_NOT_ALLOWED 0x13', ()=>{
      it ('double quoted string is not allowed v1', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = `@concat("okay..''..")`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(19);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).eq(8);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).eq(20);
      })
    })


    describe('INCOMPLETE_FUNCTION_CALL 0x14', ()=>{
      it ('incomplete function invocation beneath a template', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =`@{addDays(utcNow(), 1}`;

        await manuallySetModelText(page, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).ok;
        expect(problems.length).eq(1);
        expect(problems[0].code).eq(20);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(2);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(10);
      })

      it ('incomplete function invocation beneath a root function call v1', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =`@addDays(utcNow(), 1`;

        await manuallySetModelText(page, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).ok;
        expect(problems.length).eq(2);
        expect(problems[1].code).eq(20);
        expect(problems[1].startPos.line).eq(0);
        expect(problems[1].startPos.character).greaterThanOrEqual(1);
        expect(problems[1].endPos.line).eq(0);
        expect(problems[1].endPos.character).lessThanOrEqual(9);
      })

      it ('incomplete function invocation beneath a root function call v2', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =`@string(addDays(utcNow(), 1)`;

        await manuallySetModelText(page, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).ok;
        expect(problems.length).eq(2);
        expect(problems[1].code).eq(20);
        expect(problems[1].startPos.line).eq(0);
        expect(problems[1].startPos.character).greaterThanOrEqual(1);
        expect(problems[1].endPos.line).eq(0);
        expect(problems[1].endPos.character).lessThanOrEqual(8);
      })
    })


    describe('MISMATCHED_CASES_FOUND 0X201', ()=>{

      it ('triple mismatched cases v1', async ()=>{
        let nextText, content, problems, warnings, allCompletionList;

        nextText = `@piPeline()['optionalpackage']?.oneoptionalString`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
        expect(warnings.length).eq(3);

        expect(warnings[0].code).eq(0x201);
        expect(warnings[0].startPos.line).eq(0);
        expect(warnings[0].startPos.character).eq(1);
        expect(warnings[0].endPos.line).eq(0);
        expect(warnings[0].endPos.character).eq(9);

        expect(warnings[1].code).eq(0x201);
        expect(warnings[1].startPos.line).eq(0);
        expect(warnings[1].startPos.character).eq(13);
        expect(warnings[1].endPos.line).eq(0);
        expect(warnings[1].endPos.character).eq(28);

        expect(warnings[2].code).eq(0x201);
        expect(warnings[2].startPos.line).eq(0);
        expect(warnings[2].startPos.character).eq(32);
        expect(warnings[2].endPos.line).eq(0);
        expect(warnings[2].endPos.character).eq(49);
      })

      it ('triple mismatched cases v2', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@piPeLine()?.optionalpackage?.oneOptionalstring`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        warnings = await seizeCurExpWarnings(page);
        hints = await seizeCurExpHints(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);
        expect(warnings.length).eq(3);
        expect(hints.length).eq(1);

        expect(warnings[0].code).eq(0x201);
        expect(warnings[0].startPos.line).eq(0);
        expect(warnings[0].startPos.character).eq(1);
        expect(warnings[0].endPos.line).eq(0);
        expect(warnings[0].endPos.character).eq(9);

        expect(warnings[1].code).eq(0x201);
        expect(warnings[1].startPos.line).eq(0);
        expect(warnings[1].startPos.character).eq(13);
        expect(warnings[1].endPos.line).eq(0);
        expect(warnings[1].endPos.character).eq(28);

        expect(warnings[2].code).eq(0x201);
        expect(warnings[2].startPos.line).eq(0);
        expect(warnings[2].startPos.character).eq(30);
        expect(warnings[2].endPos.line).eq(0);
        expect(warnings[2].endPos.character).eq(47);


        expect(hints[0].code).eq(0x801);
        expect(hints[0].startPos.line).eq(0);
        expect(hints[0].startPos.character).eq(11);
        expect(hints[0].endPos.line).eq(0);
        expect(hints[0].endPos.character).eq(13);
      })

    })

  });
}

module.exports = {generateValidationTests};
