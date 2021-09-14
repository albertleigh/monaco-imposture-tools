const chai = require('chai');
const expect = chai.expect;
const {
  EXPRESSION_EDITOR_ID, typeInMonacoEditor,clearUpMonacoEditor,
  collectMonacoListRowsAriaLabels, clearPageErrors, seizePageErrors,
  seizeCurExpProb, seizeCurExpTxt, hoverOneSpanContaining, triggerCompletionOfCurrentCursor
} = require("./utils");

function generateAtSymbolTests(openOnePage, closeOnePage) {
  describe('at-symbol test cases', ()=>{

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

    it('populate completion list right after @', async ()=>{
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, '@');
      const allCompletionList = await collectMonacoListRowsAriaLabels(page);
      expect(allCompletionList.length>0).ok;

      const problems = await seizeCurExpProb(page);
      // Invalid symbol @ which missed following identifiers
      expect(problems.length).eq(1);
      expect(problems[0].code).eq(1);
      expect(problems[0].startPos.character).eq(0);
      expect(problems[0].endPos.character).eq(1);

    })

    it('populate completion list right within @{}', async ()=>{
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, '@{');

      // await page.keyboard.press('ArrowLeft');
      // trigger ctrl + space
      await triggerCompletionOfCurrentCursor(page);

      const allCompletionList = await collectMonacoListRowsAriaLabels(page);
      expect(allCompletionList.length>0).ok;

      const problems = await seizeCurExpProb(page);
      // Invalid symbol @ which missed following identifiers
      expect(problems.length).eq(0);

    })

    it('populate completion list right within @{} v2', async ()=>{
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, '@{add');

      // await page.keyboard.press('ArrowLeft');
      // trigger ctrl + space
      await triggerCompletionOfCurrentCursor(page);

      const allCompletionList = await collectMonacoListRowsAriaLabels(page);
      expect(allCompletionList.length>0).ok;

    })

    it('escaped & invalid @ symbols', async ()=>{
      const nextText = '@@@ @ @add(1, 2)';
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
      const content = await seizeCurExpTxt(page);
      const problems = await seizeCurExpProb(page);
      expect(content).eq(nextText);
      expect(problems.length).eq(2);
      // Invalid symbol @' code 0x1
      expect(problems[0].code).eq(1);
      expect(problems[1].code).eq(1);
    })

    it('multiple identifiers exist within the root statement', async ()=>{
      const nextText = "@add(1, 2)@concat('a', 'b')";
      await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);
      const content = await seizeCurExpTxt(page);
      const problems = await seizeCurExpProb(page);
      expect(content).eq(nextText);
      expect(problems.length).eq(2);
      // Miss a preceding comma
      expect(problems[0].code).eq(2);
      // Cannot have multiple identifiers within the root statement
      expect(problems[1].code).eq(10);

      await hoverOneSpanContaining(page, 'concat');
      const hoverRows  = await page.$$('.monaco-hover-content .hover-row');
      expect(hoverRows.length).eq(5);
    })
  });
}

module.exports = {generateAtSymbolTests};
