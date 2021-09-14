const chai = require('chai');
const expect = chai.expect;
const {clearUpMonacoEditor, clearPageErrors, seizePageErrors,
  delay,
  typeInMonacoEditor,
  EXPRESSION_EDITOR_ID,
  seizeCurExpProb
} = require("./utils");

function generateMultilineTests(openOnePage, closeOnePage) {

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

  it('simple multi-line expression 1#', async ()=>{
    const nextText = '@add(\n1,\n2';
    await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

    const problems = await seizeCurExpProb(page);
    expect(problems.length).eq(0);
  })


  it('simple multi-line expression 2#', async ()=>{
    const nextText = '@add(\n1,\n2';
    await typeInMonacoEditor(page, EXPRESSION_EDITOR_ID, nextText);

    // append a space to the right parentheses
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Home');
    await page.keyboard.press('Space');

    // pause for effect
    await delay(750);

    const problems = await seizeCurExpProb(page);
    expect(problems.length).eq(0);
  })


}


module.exports = {generateMultilineTests};
