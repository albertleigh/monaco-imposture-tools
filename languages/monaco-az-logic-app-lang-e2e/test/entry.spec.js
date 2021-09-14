// const chai = require('chai');
const puppeteer = require('puppeteer');
const pti = require('puppeteer-to-istanbul')

const {delay} = require('./utils');
const {generateMultilineTests} = require("./multi-lines.spec");
const {generateAtSymbolTests} = require("./at-symbol.spec");
const {generateCompletionTests} = require("./completion.spec");
const {generateValidationTests} = require("./validation.spec");

const IS_CI = process.env.CI === 'true';

describe('azLgcAppLang e2e tests', () => {
  let browser;

  before(async ()=>{
    browser = await puppeteer.launch({
      headless: IS_CI, slowMo: 50, devtools:!IS_CI,
      args:[
        '--window-size=1440,900',
      ]
    });
  })

  after( async ()=>{
    await browser.close();
  })

  async function openOnePage() {
    const page = await browser.newPage();
    await Promise.all([
      page.coverage.startJSCoverage(),
      page.coverage.startCSSCoverage()
    ]);
    await page.goto('http://localhost:3003');
    // pause for effects
    await delay(4000);
    await page.evaluate(function (){
      console.stderr = console.error.bind(console);
      console.error = function () {
        console.stderrlog = console.stderrlog || new Array();
        console.stderrlog.push(Array.from(arguments));
        console.stderr.apply(console, arguments);
      }
    })
    return page;
  }

  async function closeOnePage(page) {
    const [jsCoverage, cssCoverage] = await Promise.all([
      page.coverage.stopJSCoverage(),
      page.coverage.stopCSSCoverage(),
    ]);

    pti.write([...jsCoverage, ...cssCoverage], {
      includeHostname: true ,
      storagePath: '../../.nyc_output',
    })
    page.close();
  }

  generateMultilineTests(openOnePage, closeOnePage);
  generateAtSymbolTests(openOnePage, closeOnePage);
  generateCompletionTests(openOnePage, closeOnePage);
  generateValidationTests(openOnePage, closeOnePage);

});
