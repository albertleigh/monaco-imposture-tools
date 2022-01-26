const chai = require('chai');
const expect = chai.expect;
const {
  EXPRESSION_EDITOR_ID, typeInMonacoEditor,clearUpMonacoEditor,
  collectMonacoListRowsAriaLabels, triggerCompletionOfCurrentCursor, seizeCurExpTxt, seizeCurExpProb, clearPageErrors,
  seizePageErrors, delay, seizeCurExpAllProb
} = require("./utils");

function generateCompletionTests(openOnePage, closeOnePage) {
  describe('completion test cases', ()=>{

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


    describe('index type completion', ()=>{
      it('pipeline index type completion v1', async ()=>{

        let nextText, content, problems, allCompletionList;

        nextText = `@pipeline()[]`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);
        await page.keyboard.press('ArrowLeft');
        await delay(250);
        await triggerCompletionOfCurrentCursor(page);


        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('DataFactory') > -1 ||
          value.indexOf('globalParameters') > -1 ||
          value.indexOf('add(') > -1
        )).ok;

      })
    })

    it('suggest completion list for a root function call', async ()=>{
      let nextText, content, problems, allCompletionList;

      nextText = '@pipe';
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
      await triggerCompletionOfCurrentCursor(page);
      await delay(250);

      await page.keyboard.press('Enter');

      await delay(250);

      content = await seizeCurExpTxt(page);
      problems = await seizeCurExpAllProb(page);
      expect(content).eq('@pipeline()');
      expect(problems.length).eq(0);

      await triggerCompletionOfCurrentCursor(page);

      await delay(250);

      allCompletionList = await collectMonacoListRowsAriaLabels(page);
      expect(allCompletionList.length>=1).ok;
      expect(allCompletionList.every(value => value.match(/^\./))).ok;

      // await page.keyboard.press('Escape');
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, '.');
      await delay(250);

      // await triggerCompletionOfCurrentCursor(page);
      // await delay(250);


      allCompletionList = await collectMonacoListRowsAriaLabels(page);
      expect(allCompletionList.length>1).ok;
      expect(allCompletionList.some(value => value.indexOf('DataFactory') > -1)).ok;

      await delay(250);

      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      await delay(250);

      content = await seizeCurExpTxt(page);
      problems = await seizeCurExpAllProb(page);
      expect(content.trim()).eq('@pipeline().globalParameters.firstGlobalStrPara');
      expect(problems.length).eq(0);
    })

    it('suggest completion list within a function name', async ()=>{
      const nextText = '@concat(pipeline().DataFactory, pipeline().GroupId)';
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
      //move to @con|
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      // trigger ctrl + space
      await triggerCompletionOfCurrentCursor(page);
      const allCompletionList = await collectMonacoListRowsAriaLabels(page);
      expect(allCompletionList.length>1).ok;

      let hasContains, hasConvertFromUtc, hasCoalesce;
      for (const oneCompletion of allCompletionList){
        hasContains = hasContains || oneCompletion.indexOf('contains(') > -1;
        hasConvertFromUtc = hasConvertFromUtc || oneCompletion.indexOf('convertFromUtc(') > -1;
        hasCoalesce = hasCoalesce || oneCompletion.indexOf('coalesce(') > -1;
      }

      expect(hasContains).ok;
      expect(hasConvertFromUtc).ok;
      expect(hasCoalesce).ok;

    })

    describe('function parameters completion', ()=>{
      it('suggest completion list for non-first function call param of empty input', async ()=>{

        let nextText, content, problems, allCompletionList;

        nextText = '@concat(pipeline().DataFactory, pipeline())';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(6);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(31);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(42);

        //move to @concat(pipeline().DataFactory, pipeline()|
        await page.keyboard.press('ArrowLeft');
        // trigger ctrl + space
        await triggerCompletionOfCurrentCursor(page);
        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;
        expect(allCompletionList.every(value =>
          value.match(/^\./)
        )).ok
      })

      it('suggest w/ unrecognized identifier', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = '@concat( p , \'\' )';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(8);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(9);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(10);

        //move to @concat(pipeline().DataFactory, pipeline()|
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');

        // trigger ctrl + space
        await triggerCompletionOfCurrentCursor(page);

        await delay(750);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;
        expect(allCompletionList.every(value =>
          value.match(/^p/)
        )).ok

        await page.keyboard.press('Enter');

        await delay(750);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        expect(content).eq('@concat( pipeline().DataFactory , \'\' )');
        expect(problems.length).eq(0);

      })

    })

    describe('constant parameter completion', ()=>{

      it('user variable 1#', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText = '@var';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=3).ok;
        expect(allCompletionList.every(value => value.indexOf('variables') > -1)).ok;


        // await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq('@variables(\'firstVar\')');
        expect(problems.length).eq(0);

        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Backspace');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);

        expect(content).eq('@variables(\'firstVa\')');
        expect(problems.length).eq(1);

        expect(problems[0].code).eq(6);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(11);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(20);

        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');

        await delay(250);
        await triggerCompletionOfCurrentCursor(page);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=3).ok;
        expect(allCompletionList.some(value => value.indexOf('first') > -1)).ok;
        expect(allCompletionList.some(value => value.indexOf('second') > -1)).ok;
        expect(allCompletionList.some(value => value.indexOf('third') > -1)).ok;

        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);

        expect(content).eq('@variables(\'secondVar\')');
        expect(problems.length).eq(0);

      })

      it('user variable 2#: restore completion', async ()=>{
        let nextText, allCompletionList;

        nextText = '@var';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=3).ok;
        expect(allCompletionList.every(value => value.indexOf('variables') > -1)).ok;


        // await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Escape');

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length===0).ok;

        await delay(250);


        await triggerCompletionOfCurrentCursor(page);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=3).ok;
        expect(allCompletionList.every(value => value.indexOf('variables') > -1)).ok;
      })

    })

    describe('identifier chain completion', ()=>{
      it('multi-line post function identifiers completion v1', async ()=>{
        let nextText, content, problems, allCompletionList;



        nextText =
          `@concat(
    pipeline().DataFactory, 
pipeline()
`;
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpProb(page);
        // expect(content).eq(nextText);
        expect(problems.length).eq(1);
        // FUNCTION_PARAMETER_TYPE_MISMATCHES code 0x006
        // Cannot fit package::**Return package pipeline** into the function parameter string list item.
        expect(problems[0].code).eq(6);
        expect(problems[0].startPos.line).eq(1);
        expect(problems[0].startPos.character).greaterThanOrEqual(27);
        expect(problems[0].endPos.line).eq(3);
        expect(problems[0].endPos.character).lessThanOrEqual(4);

        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('End');

        await triggerCompletionOfCurrentCursor(page);
        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;
        expect(allCompletionList.every(value =>
          value.match(/^\./)
        )).ok
      })

      it('multi-line post function identifiers completion v2', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =
          `@concat(
    pipeline().DataFactory,
pipeline().`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        await page.keyboard.press('Escape');

        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('End');

        await delay(250);

        await triggerCompletionOfCurrentCursor(page);
        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('DataFactory')
        )> -1).ok

        expect(allCompletionList.some(value =>
          value.indexOf('globalParameters')
        )> -1).ok

      })

      it('multi-line post function identifiers completion v3', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =
          `@concat(
    pipeline().DataFactory,
pipeline().global`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        await page.keyboard.press('Escape');

        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('End');

        await delay(250);

        await triggerCompletionOfCurrentCursor(page);
        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.every(value =>
          value.match(/^\.global/)
        )).ok

      })

      it('multi-line post function identifiers completion v4', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =
          `@concat(
  pipeline().,
pipeline().globalParameters.firstGlobalStrPara`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        // await page.keyboard.press('Escape');

        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowLeft');

        await delay(250);

        await triggerCompletionOfCurrentCursor(page);
        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('DataFactory') > -1
        )).ok

        expect(allCompletionList.some(value =>
          value.indexOf('globalParameters') > -1
        )).ok

      })

      it('multi-line post function identifiers completion v5', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =
          `@concat(
  pipeline(),
pipeline().globalParameters.firstGlobalStrPara`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        // await page.keyboard.press('Escape');

        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowLeft');

        await delay(250);

        await triggerCompletionOfCurrentCursor(page);
        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('DataFactory') > -1
        )).ok

        expect(allCompletionList.some(value =>
          value.indexOf('globalParameters') > -1
        )).ok

      })

      it('one-line post function identifiers completion v1', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =`@pipeline().globalParameters`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq(nextText);
        expect(problems.length).eq(0);

        await triggerCompletionOfCurrentCursor(page);
        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;
        expect(allCompletionList.every(value =>
          value.match(/^\.globalParameters/)
        )).ok

      })

      it('multi-line function call of an unfinished identifier completion v1', async ()=>{
        let nextText, content, problems, allCompletionList;

        nextText =
          `@createArray(
    s`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        await page.keyboard.press('Escape');

        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('End');

        await delay(250);

        await triggerCompletionOfCurrentCursor(page);
        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.match(/^s/)
        )).ok;

        expect(allCompletionList.every(value =>
          value.indexOf('s') > -1
        )).ok;

      })

    })

    describe('post optional accessor completion', ()=>{

      it('suggest completion list right after one optional accessor v1', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@pipeline().optionalPackage?.`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        await triggerCompletionOfCurrentCursor(page);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);

        expect(allCompletionList.length>0).ok;

        let hasOptional;
        for (const oneCompletion of allCompletionList){
          hasOptional = hasOptional || oneCompletion.indexOf('optionalPackage') > -1;
        }

        expect(hasOptional).ok;
      })

    })

    describe('suggest completion list for a package allow additional properties of any', ()=>{

      it ('allowAdditionalAnyProperties v1', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('Lookup 3').output.v`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);
        await triggerCompletionOfCurrentCursor(page);


        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('.output.value') > -1
        )).ok;
      })

    })

    describe('suggest completion list for array of type', ()=>{

      it ('literal inner count v1', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('GetFileMetadata 1').output.structure[].name`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(1);
        expect(problems[0].code).eq(16);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(47);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(49);

        await triggerCompletionOfCurrentCursor(page);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('_$ValueDescriptionDictionaryFunctionKey') > -1
        )).not.ok;
      })

      it('post array of type item v1', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('GetFileMetadata 1').output.structure[add(1,2)]`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(0);

        await triggerCompletionOfCurrentCursor(page);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('.name') > -1 ||
          value.indexOf('.type') > -1
        )).ok;

        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq('@activity(\'GetFileMetadata 1\').output.structure[add(1,2)].name');
        expect(problems.length).eq(0);
      })

      it('post array of type item v2', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('GetFileMetadata 1').output.structure[add(1,2)].`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(1);
        expect(problems[0].code).eq(14);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(57);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(58);

        await triggerCompletionOfCurrentCursor(page);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('.name') > -1 ||
          value.indexOf('.type') > -1
        )).ok;

        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq('@activity(\'GetFileMetadata 1\').output.structure[add(1,2)].name');
        expect(problems.length).eq(0);
      })

      it('post array of type item v3', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('GetFileMetadata 2').output.structure[1].`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(1);
        expect(problems[0].code).eq(14);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(50);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(51);

        await triggerCompletionOfCurrentCursor(page);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('.name') > -1 ||
          value.indexOf('.type') > -1
        )).ok;

        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq('@activity(\'GetFileMetadata 2\').output.structure[1].name');
        expect(problems.length).eq(0);
      })

      it('post array of type item v4', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('GetFileMetadata 2').output.structure[add(1,2)].na`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(0);

        await triggerCompletionOfCurrentCursor(page);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('.name') > -1
        )).ok;

        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq('@activity(\'GetFileMetadata 2\').output.structure[add(1,2)].name');
        expect(problems.length).eq(0);
      })

      it('post array of type item v5', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('GetFileMetadata 2').output.structure[1].na`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(0);

        await triggerCompletionOfCurrentCursor(page);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('.name') > -1
        )).ok;

        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq('@activity(\'GetFileMetadata 2\').output.structure[1].name');
        expect(problems.length).eq(0);
      })

      it('completion list containing the array of type item v1', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('GetFolderMetadata 2').output`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(0);

        await triggerCompletionOfCurrentCursor(page);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('.exists') > -1
        )).ok;

        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq("@activity('GetFolderMetadata 2').output.childItems");
        expect(problems.length).eq(0);
      })

      it('completion list containing the array of type item v2', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('GetFolderMetadata 2').output.`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(1);
        expect(problems[0].code).eq(14);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(39);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(40);

        await triggerCompletionOfCurrentCursor(page);

        await delay(250);

        allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;

        expect(allCompletionList.some(value =>
          value.indexOf('exists') > -1
        )).ok;

        await page.keyboard.press('Enter');

        await delay(250);

        content = await seizeCurExpTxt(page);
        problems = await seizeCurExpAllProb(page);
        expect(content).eq("@activity('GetFolderMetadata 2').output.childItems");
        expect(problems.length).eq(0);
      })

      it('completion list not containing the array of type item v1', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('Get Default 1')`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(0);

        await page.keyboard.press('Escape');

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
      })

      it('completion list not containing the array of type item v2', async ()=>{
        let nextText, content, problems, warnings, hints, allCompletionList;

        nextText = `@activity('Get Default 2').`;

        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        await delay(250);

        problems = await seizeCurExpProb(page);
        expect(problems.length).eq(1);
        expect(problems[0].code).eq(14);
        expect(problems[0].startPos.line).eq(0);
        expect(problems[0].startPos.character).greaterThanOrEqual(26);
        expect(problems[0].endPos.line).eq(0);
        expect(problems[0].endPos.character).lessThanOrEqual(27);

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
        expect(content).eq("@activity('Get Default 2').output");
        expect(problems.length).eq(0);
      })

    })

  });
}

module.exports = {generateCompletionTests};
