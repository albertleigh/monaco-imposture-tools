const OnigRegExp = require('..').OnigRegExp;
const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;

describe('OnigRegExp', () => {
  describe('::search(string, index, callback)', () => {
    it('returns an array of the match and all capture groups', () => {
      let regex = new OnigRegExp('\\w(\\d+)');
      let searchCallback = sinon.spy();
      let result = regex.search('----a123----', searchCallback);

      expect(searchCallback.callCount).eq(1);

      result = searchCallback.getCall(0).args[1];
      expect(result.length).eq(2);
      expect(result[0].match).eq('a123');
      expect(result[0].start).eq(4);
      expect(result[0].end).eq(8);
      expect(result[0].index).eq(0);
      expect(result[0].length).eq(4);
      expect(result[1].match).eq('123');
      expect(result[1].start).eq(5);
      expect(result[1].end).eq(8);
      expect(result[1].index).eq(1);
      expect(result[1].length).eq(3);
    });

    it('returns null if it does not match', () => {
      let regex = new OnigRegExp('\\w(\\d+)');
      let searchCallback = sinon.spy();
      let result = regex.search('--------', searchCallback);

      expect(searchCallback.callCount).eq(1);

      result = searchCallback.getCall(0).args[1];
      expect(result).to.be.not.ok;
    });

    describe('when the string being searched contains a unicode character', () =>
      it('returns correct indices and lengths', () => {
        let regex = new OnigRegExp('a');
        let searchCallback = sinon.spy();
        regex.search('ç√Ωa', 0, searchCallback);

        expect(searchCallback.callCount).eq(1);

        let firstMatch = searchCallback.getCall(0).args[1];
        expect(firstMatch[0].start).eq(3);
        expect(firstMatch[0].match).eq('a');
        regex.search('ç√Ωabcd≈ßåabcd', 5, searchCallback);

        expect(searchCallback.callCount).eq(2);

        let secondMatch = searchCallback.getCall(1).args[1];
        expect(secondMatch[0].start).eq(10);
        expect(secondMatch[0].match).eq('a');
      }));

    describe('when the string being searched contains non-Basic Multilingual Plane characters', () =>
      it('returns correct indices and matches', () => {
        let regex = new OnigRegExp("'");
        let searchCallback = sinon.spy();
        regex.search("'\uD835\uDF97'", 0, searchCallback);

        expect(searchCallback.callCount).eq(1);

        let match = searchCallback.getCall(0).args[1];
        expect(match[0].start).eq(0);
        expect(match[0].match).eq("'");
        regex.search("'\uD835\uDF97'", 1, searchCallback);

        expect(searchCallback.callCount).eq(2);

        match = searchCallback.getCall(1).args[1];
        expect(match[0].start).eq(3);
        expect(match[0].match).eq("'");
        regex.search("'\uD835\uDF97'", 2, searchCallback);

        expect(searchCallback.callCount).eq(3);

        match = searchCallback.getCall(2).args[1];
        expect(match[0].start).eq(3);
        expect(match[0].match).eq("'");
      }));
  });

  describe('::searchSync(string, index)', () => {
    it('returns an array of the match and all capture groups', () => {
      let regex = new OnigRegExp('\\w(\\d+)');
      let result = regex.searchSync('----a123----');
      expect(result.length).eq(2);
      expect(result[0].match).eq('a123');
      expect(result[0].start).eq(4);
      expect(result[0].end).eq(8);
      expect(result[0].index).eq(0);
      expect(result[0].length).eq(4);
      expect(result[1].match).eq('123');
      expect(result[1].start).eq(5);
      expect(result[1].end).eq(8);
      expect(result[1].index).eq(1);
      expect(result[1].length).eq(3);
    });

    it('returns null if it does not match', () => {
      let regex = new OnigRegExp('\\w(\\d+)');
      let result = regex.searchSync('--------');
      expect(result).null;
    });

    describe('when the string being searched contains a unicode character', () =>
      it('returns correct indices and lengths', () => {
        let regex = new OnigRegExp('a');

        let firstMatch = regex.searchSync('ç√Ωa', 0);
        expect(firstMatch[0].start).eq(3);
        expect(firstMatch[0].match).eq('a');

        let secondMatch = regex.searchSync('ç√Ωabcd≈ßåabcd', 5);
        expect(secondMatch[0].start).eq(10);
        expect(secondMatch[0].match).eq('a');
      }));

    describe('when the string being searched contains non-Basic Multilingual Plane characters', () =>
      it('returns correct indices and matches', () => {
        let regex = new OnigRegExp("'");

        let match = regex.searchSync("'\uD835\uDF97'", 0);
        expect(match[0].start).eq(0);
        expect(match[0].match).eq("'");

        match = regex.searchSync("'\uD835\uDF97'", 1);
        expect(match[0].start).eq(3);
        expect(match[0].match).eq("'");

        match = regex.searchSync("'\uD835\uDF97'", 2);
        expect(match[0].start).eq(3);
        expect(match[0].match).eq("'");

        match = regex.searchSync("'\uD835\uDF97'", 3);
        expect(match[0].start).eq(3);
        expect(match[0].match).eq("'");
      }));
  });

  describe('::testSync(string)', () =>
    it('returns true if the string matches the pattern', () => {
      expect(new OnigRegExp('a[b-d]c').testSync('aec')).false;
      expect(new OnigRegExp('a[b-d]c').testSync('abc')).true;
      expect(new OnigRegExp(false).testSync(false)).true;
      expect(new OnigRegExp(false).testSync(true)).false;
    }));

  describe('::test(string, callback)', () =>
    it('calls back with true if the string matches the pattern', () => {
      let testCallback = sinon.spy();

      new OnigRegExp('a[b-d]c').test('aec', testCallback);

      expect(testCallback.callCount).eq(1);

      expect(testCallback.getCall(0).args[0]).null;
      expect(testCallback.getCall(0).args[1]).false;
      new OnigRegExp('a[b-d]c').test('abc', testCallback);

      expect(testCallback.callCount).eq(2);

      expect(testCallback.getCall(1).args[0]).null;
      expect(testCallback.getCall(1).args[1]).true;
    }));
});
