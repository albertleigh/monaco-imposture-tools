const OnigScanner = require('..').OnigScanner;
const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;

describe('OnigScanner', () => {
  describe('::findNextMatchSync', () => {
    it('returns the index of the matching pattern', () => {
      let scanner = new OnigScanner(['a', 'b', 'c']);
      expect(scanner.findNextMatchSync('x', 0)).eq(null);
      expect(scanner.findNextMatchSync('xxaxxbxxc', 0).index).eq(0);
      expect(scanner.findNextMatchSync('xxaxxbxxc', 4).index).eq(1);
      expect(scanner.findNextMatchSync('xxaxxbxxc', 7).index).eq(2);
      expect(scanner.findNextMatchSync('xxaxxbxxc', 9)).eq(null);
    });

    it('includes the scanner with the results', () => {
      let scanner = new OnigScanner(['a']);
      expect(scanner.findNextMatchSync('a', 0).scanner).eq(scanner);
    });

    describe('when the string searched contains unicode characters', () => {
      it('returns the correct matching pattern', () => {
        let scanner = new OnigScanner(['1', '2']);
        let match = scanner.findNextMatchSync('ab…cde21', 5);
        expect(match.index).eq(1);

        scanner = new OnigScanner(['"']);
        match = scanner.findNextMatchSync('{"…": 1}', 1);
        expect(match.captureIndices).deep.eq([{index: 0, start: 1, end: 2, length: 1}]);
      });
    });

    describe('when the string searched contains surrogate pairs', () => {
      it('counts paired characters as 2 characters in both arguments and return values', () => {
        let scanner = new OnigScanner(['Y', 'X']);
        let match = scanner.findNextMatchSync('a💻bYX', 0);
        expect(match.captureIndices).deep.eq([{index: 0, start: 4, end: 5, length: 1}]);

        match = scanner.findNextMatchSync('a💻bYX', 1);
        expect(match.captureIndices).deep.eq([{index: 0, start: 4, end: 5, length: 1}]);

        match = scanner.findNextMatchSync('a💻bYX', 3);
        expect(match.captureIndices).deep.eq([{index: 0, start: 4, end: 5, length: 1}]);

        match = scanner.findNextMatchSync('a💻bYX', 4);
        expect(match.captureIndices).deep.eq([{index: 0, start: 4, end: 5, length: 1}]);

        match = scanner.findNextMatchSync('a💻bYX', 5);
        expect(match.index).eq(1);
        expect(match.captureIndices).deep.eq([{index: 0, start: 5, end: 6, length: 1}]);
      });
    });

    it("returns false when the input string isn't a string", () => {
      const scanner = new OnigScanner(['1']);

      expect(scanner.findNextMatchSync()).eq(null);
      expect(scanner.findNextMatchSync(null)).eq(null);
      expect(scanner.findNextMatchSync(2)).eq(null);
      expect(scanner.findNextMatchSync(false)).eq(null);
    });
  });

  describe('when the regular expression contains double byte characters', () =>
    it('returns the correct match length', () => {
      let scanner = new OnigScanner(['Возврат']);
      let match = scanner.findNextMatchSync('Возврат long_var_name;', 0);
      expect(match.captureIndices).deep.eq([{index: 0, start: 0, end: 7, length: 7}]);
    }));

  describe('when the input string contains invalid surrogate pairs', () => {
    it('interprets them as a code point', () => {
      let scanner = new OnigScanner(['X']);
      let match = scanner.findNextMatchSync(`X${String.fromCharCode(0xd83c)}X`, 0);
      expect(match.captureIndices).deep.eq([{index: 0, start: 0, end: 1, length: 1}]);

      match = scanner.findNextMatchSync(`X${String.fromCharCode(0xd83c)}X`, 1);
      expect(match.captureIndices).deep.eq([{index: 0, start: 2, end: 3, length: 1}]);

      match = scanner.findNextMatchSync(`X${String.fromCharCode(0xd83c)}X`, 2);
      expect(match.captureIndices).deep.eq([{index: 0, start: 2, end: 3, length: 1}]);

      match = scanner.findNextMatchSync(`X${String.fromCharCode(0xdfff)}X`, 0);
      expect(match.captureIndices).deep.eq([{index: 0, start: 0, end: 1, length: 1}]);

      match = scanner.findNextMatchSync(`X${String.fromCharCode(0xdfff)}X`, 1);
      expect(match.captureIndices).deep.eq([{index: 0, start: 2, end: 3, length: 1}]);

      match = scanner.findNextMatchSync(`X${String.fromCharCode(0xdfff)}X`, 2);
      expect(match.captureIndices).deep.eq([{index: 0, start: 2, end: 3, length: 1}]);

      // These are actually valid, just testing the min & max
      match = scanner.findNextMatchSync(`X${String.fromCharCode(0xd800)}${String.fromCharCode(0xdc00)}X`, 2);
      expect(match.captureIndices).deep.eq([{index: 0, start: 3, end: 4, length: 1}]);

      match = scanner.findNextMatchSync(`X${String.fromCharCode(0xdbff)}${String.fromCharCode(0xdfff)}X`, 2);
      expect(match.captureIndices).deep.eq([{index: 0, start: 3, end: 4, length: 1}]);
    });
  });

  describe('when the start offset is out of bounds', () =>
    it('it gets clamped', () => {
      const scanner = new OnigScanner(['X']);
      let match = scanner.findNextMatchSync('X💻X', -1000);
      expect(match.captureIndices).deep.eq([{index: 0, start: 0, end: 1, length: 1}]);

      match = scanner.findNextMatchSync('X💻X', 1000);
      expect(match).eq(null);
    }));

  describe('::findNextMatch', () => {
    let matchCallback;

    beforeEach(() => (matchCallback = sinon.spy()));

    it('returns the index of the matching pattern', async () => {
      let scanner = new OnigScanner(['a', 'b', 'c']);
      scanner.findNextMatch('x', 0, matchCallback);

      expect(matchCallback.callCount).eq(1);
      expect(matchCallback.getCall(0).args[0]).null;
      expect(matchCallback.getCall(0).args[1]).null;

      scanner.findNextMatch('xxaxxbxxc', 0, matchCallback);

      expect(matchCallback.callCount).eq(2);
      expect(matchCallback.getCall(1).args[0]).null;
      expect(matchCallback.getCall(1).args[1].index).eq(0);

      scanner.findNextMatch('xxaxxbxxc', 4, matchCallback);

      expect(matchCallback.callCount).eq(3);
      expect(matchCallback.getCall(2).args[0]).null;
      expect(matchCallback.getCall(2).args[1].index).eq(1);

      scanner.findNextMatch('xxaxxbxxc', 7, matchCallback);

      expect(matchCallback.callCount).eq(4);
      expect(matchCallback.getCall(3).args[0]).null;
      expect(matchCallback.getCall(3).args[1].index).eq(2);

      scanner.findNextMatch('xxaxxbxxc', 9, matchCallback);

      expect(matchCallback.callCount).eq(5);
      expect(matchCallback.getCall(0).args[0]).null;
      expect(matchCallback.getCall(0).args[1]).null;
    });

    it('includes the scanner with the results', () => {
      const scanner = new OnigScanner(['a']);
      scanner.findNextMatch('a', 0, matchCallback);

      expect(matchCallback.callCount).eq(1);
      expect(matchCallback.getCall(0).args[0]).null;
      expect(matchCallback.getCall(0).args[1].scanner).eq(scanner);
    });

    describe('when the string searched contains unicode characters', () => {
      it('returns the correct matching pattern', () => {
        const scanner = new OnigScanner(['1', '2']);
        scanner.findNextMatch('ab…cde21', 5, matchCallback);

        expect(matchCallback.callCount).eq(1);
        expect(matchCallback.getCall(0).args[0]).null;
        expect(matchCallback.getCall(0).args[1].index).eq(1);
      });
    });

    describe('when searching with start index', () => {
      it('returns correct results for indexes > 255', () => {
        const scanner = new OnigScanner(['88']);
        const content = Array(300)
          .join()
          .split(',')
          .map((v, i) => String(i))
          .join(' '); // '0 1 2 3 4 ...298 299'

        let match = scanner.findNextMatchSync(content, 0);
        expect(!!match).true;
        expect(match.captureIndices[0].start).eq(254);

        match = scanner.findNextMatchSync(content, 260);
        expect(!!match).true;
        expect(match.captureIndices[0].start).eq(643);

        match = scanner.findNextMatchSync(content, 650);
        expect(!!match).true;
        expect(match.captureIndices[0].start).eq(1043);

        match = scanner.findNextMatchSync(content, 1050);
        expect(!!match).false;
      });
    });
  });
});
