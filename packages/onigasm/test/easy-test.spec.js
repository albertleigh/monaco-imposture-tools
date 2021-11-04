const OnigString = require('..').OnigString;
const OnigScanner = require('..').OnigScanner;
const chai = require('chai');
const expect = chai.expect;

describe('Scanner', () => {
  it('does not throw on PHP regexp from issue #17', () => {
    const scanner = new OnigScanner([
      '(?i)^\\s*(trait)\\s+([a-z_\\x{7f}-\\x{7fffffff}][a-z0-9_\\x{7f}-\\x{7fffffff}]*)',
    ]);
    const res = scanner.findNextMatchSync(new OnigString('trait test {\n'), 0);
    expect(res.captureIndices[1].start).eq(0);
  });
});
