const chai = require('chai');
const expect = chai.expect;
const {
  EXPRESSION_EDITOR_ID, typeInMonacoEditor,clearUpMonacoEditor,
  triggerCompletionOfCurrentCursor, seizeCurExpTxt, seizeCurExpProb, delay, clearPageErrors, seizePageErrors,
  seizeCurExpWarnings, seizeCurExpHints, seizeCurExpAllProb
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
        '@addHours(utcNow(),-5)',
        '@take([string(1), string(1)], 2)',
        "@activity('Get Metadata1').output2fewfwelf",
        "@activity('Get Metadata1').output[string(1)]",
        "@pipeline()['TriggeredByPipelineName']",
        "@activity('Get Metadata1').output[string(1)]",
        "@pipeline()['DataFactory']",
        "@activity('Get Metadata1').output.childItems[0].name",
        "@item().one.two.three",
        "@item().one['two'].three",
        "@contains( [pipeline().DataFactory], [pipeline().GroupId] )",
        "@pipeline().globalParameters?.firstGlobalStrPara",
        "@pipeline().optionalPackage?.oneOptionalString",
        "@pipeline()?.TriggeredByPipelineName",
        "@piPeline()?.optionalpackage?.oneOptionalString",
        "@piPeline()['optionalpackage']?.oneoptionalString",
        "@contains(json(item().DataLoadingBehaviorSettings).watermarkColumnType, 'Int')",
        "@contains(json(item().DataLoadingBehaviorSettings).watermarkColumnType, [])",
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
      })
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

      it('The function call lacked or had more parameters required:: root level', async ()=>{
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

        nextText = '@take("onestring", 2 )';
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
        const nextText = '@pipeline().DataFactory2';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Unrecognized identifiers of the function result
        expect(problems[0].code).eq(9);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(11);
        expect(problems[0].endPos.character).lessThanOrEqual(24);
      })

      it('invalid identifier chain 2# w/o function call', async ()=>{
        const nextText = '@pipeline.DataFactory2';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // Unrecognized identifiers of the function result
        expect(problems[0].code).eq(8);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(0);
        expect(problems[0].endPos.character).lessThanOrEqual(22);
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
        expect(problems[0].endPos.character).lessThanOrEqual(3);

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

        nextText = `@activity('Get Metadata1').output[string(1), string(1)]`;

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

        nextText = `@activity('Get Metadata1').output[].one.two.tree`;

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
          `@activity('Get Metadata1').output[
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
        expect(problems[0].endPos.line).eq(2);
        expect(problems[0].endPos.character).lessThanOrEqual(5);

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
        expect(warnings[0].endPos.character).eq(11);

        expect(warnings[1].code).eq(0x201);
        expect(warnings[1].startPos.line).eq(0);
        expect(warnings[1].startPos.character).eq(11);
        expect(warnings[1].endPos.line).eq(0);
        expect(warnings[1].endPos.character).eq(30);

        expect(warnings[2].code).eq(0x201);
        expect(warnings[2].startPos.line).eq(0);
        expect(warnings[2].startPos.character).eq(30);
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
        expect(warnings[0].endPos.character).eq(11);

        expect(warnings[1].code).eq(0x201);
        expect(warnings[1].startPos.line).eq(0);
        expect(warnings[1].startPos.character).eq(11);
        expect(warnings[1].endPos.line).eq(0);
        expect(warnings[1].endPos.character).eq(28);

        expect(warnings[2].code).eq(0x201);
        expect(warnings[2].startPos.line).eq(0);
        expect(warnings[2].startPos.character).eq(28);
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
