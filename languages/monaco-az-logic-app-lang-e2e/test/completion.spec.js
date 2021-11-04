const chai = require('chai');
const expect = chai.expect;
const {
  EXPRESSION_EDITOR_ID, typeInMonacoEditor,clearUpMonacoEditor,
  collectMonacoListRowsAriaLabels, triggerCompletionOfCurrentCursor, seizeCurExpTxt, seizeCurExpProb, clearPageErrors,
  seizePageErrors, delay
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

    it('suggest completion list for a root function call', async ()=>{
      let nextText, content, problems, allCompletionList;

      nextText = '@pipe';
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
      await page.keyboard.press('Enter');

      await delay(250);

      content = await seizeCurExpTxt(page);
      problems = await seizeCurExpProb(page);
      expect(content).eq('@pipeline()');
      expect(problems.length).eq(0);

      await triggerCompletionOfCurrentCursor(page);

      await delay(250);

      allCompletionList = await collectMonacoListRowsAriaLabels(page);
      expect(allCompletionList.length>=1).ok;
      expect(allCompletionList.some(value => value.indexOf('pipeline()') > -1)).ok;

      // await page.keyboard.press('Escape');
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, '.');
      await delay(250);

      // await triggerCompletionOfCurrentCursor(page);
      // await delay(250);


      allCompletionList = await collectMonacoListRowsAriaLabels(page);
      expect(allCompletionList.length>1).ok;
      expect(allCompletionList.some(value => value.indexOf('Trigger') > -1)).ok;

      await delay(250);

      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      await delay(250);

      content = await seizeCurExpTxt(page);
      problems = await seizeCurExpProb(page);
      expect(content).eq('@pipeline().GroupId');
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
        const nextText = '@concat(pipeline().DataFactory, pipeline())';
        await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

        const content = await seizeCurExpTxt(page);
        const problems = await seizeCurExpProb(page);
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
        const allCompletionList = await collectMonacoListRowsAriaLabels(page);
        expect(allCompletionList.length>=1).ok;
        let pipelineNotExist = false;
        allCompletionList.some(value => {
          if (value.indexOf('pipeline()') === -1){
            pipelineNotExist = true;
            return true;
          }
          return false;
        })
        expect(pipelineNotExist).not.ok;
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
        problems = await seizeCurExpProb(page);
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
        problems = await seizeCurExpProb(page);

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

  });
}

module.exports = {generateCompletionTests};