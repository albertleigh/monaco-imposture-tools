const OnigString = require('..').OnigString;
const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;

describe('OnigString', () => {
  it('has a length property', () => {
    expect(new OnigString('yoo').length).eq(3);
  });

  it('can be converted back into a string', () => {
    expect(new OnigString('abc').toString()).eq('abc');
  });

  it('can retrieve substrings (for conveniently inspecting captured text)', () => {
    const str = 'abcdef';
    const onigStr = new OnigString(str);

    expect(onigStr.substring(2, 3)).eq(str.substring(2, 3));
    expect(onigStr.substring(2)).eq(str.substring(2));
    expect(onigStr.substring()).eq(str.substring());
    expect(onigStr.substring(-1)).eq(str.substring(-1));
    expect(onigStr.substring(-1, -2)).eq(str.substring(-1, -2));

    onigStr.substring({});
    onigStr.substring(null, undefined);
  });

  it('handles invalid arguments', () => {
    expect(() => {
      new OnigString(undefined);
    }).to.throw(TypeError, 'Argument must be a string');
  });

  it('handles encoding', () => {
    const str = new OnigString('Wörld');
    expect(Array.from(str.utf8Bytes)).deep.eq([0x57, 0xc3, 0xb6, 0x72, 0x6c, 0x64, 0x00]);

    expect(str.convertUtf16OffsetToUtf8(0)).eq(0);
    expect(str.convertUtf16OffsetToUtf8(1)).eq(1);
    expect(str.convertUtf16OffsetToUtf8(2)).eq(3);
    expect(str.convertUtf16OffsetToUtf8(3)).eq(4);

    expect(str.convertUtf8OffsetToUtf16(0)).eq(0);
    expect(str.convertUtf8OffsetToUtf16(1)).eq(1);
    expect(str.convertUtf8OffsetToUtf16(2)).eq(1);
    expect(str.convertUtf8OffsetToUtf16(3)).eq(2);
    expect(str.convertUtf8OffsetToUtf16(4)).eq(3);
  });

  it('mapping 2/3/4 byte UTF-8 encoding', () => {
    const str = new OnigString('123$¢€𐍈123');

    expect(Array.from(str.utf8Bytes)).deep.eq([
      0x31 /*1*/, 0x32 /*2*/, 0x33 /*3*/, 0x24 /*$*/, 0xc2 /*¢*/, 0xa2, 0xe2 /*€*/, 0x82, 0xac, 0xf0 /*𐍈*/, 0x90, 0x8d,
      0x88, 0x31 /*1*/, 0x32 /*2*/, 0x33 /*3*/, 0x00,
    ]);
    expect(str.convertUtf16OffsetToUtf8(0)).eq(0);
    expect(str.convertUtf16OffsetToUtf8(1)).eq(1);
    expect(str.convertUtf16OffsetToUtf8(2)).eq(2);
    expect(str.convertUtf16OffsetToUtf8(3)).eq(3);
    expect(str.convertUtf16OffsetToUtf8(4)).eq(4);
    expect(str.convertUtf16OffsetToUtf8(5)).eq(6);
    expect(str.convertUtf16OffsetToUtf8(6)).eq(9);
    expect(str.convertUtf16OffsetToUtf8(7)).eq(9);
    expect(str.convertUtf16OffsetToUtf8(8)).eq(13);
    expect(str.convertUtf16OffsetToUtf8(9)).eq(14);
    expect(str.convertUtf16OffsetToUtf8(10)).eq(15);

    expect(str.convertUtf8OffsetToUtf16(0)).eq(0);
    expect(str.convertUtf8OffsetToUtf16(1)).eq(1);
    expect(str.convertUtf8OffsetToUtf16(2)).eq(2);
    expect(str.convertUtf8OffsetToUtf16(3)).eq(3);
    expect(str.convertUtf8OffsetToUtf16(4)).eq(4);
    expect(str.convertUtf8OffsetToUtf16(5)).eq(4);
    expect(str.convertUtf8OffsetToUtf16(6)).eq(5);
    expect(str.convertUtf8OffsetToUtf16(7)).eq(5);
    expect(str.convertUtf8OffsetToUtf16(8)).eq(5);
    expect(str.convertUtf8OffsetToUtf16(9)).eq(6);
    expect(str.convertUtf8OffsetToUtf16(10)).eq(6);
    expect(str.convertUtf8OffsetToUtf16(11)).eq(6);
    expect(str.convertUtf8OffsetToUtf16(12)).eq(6);
    expect(str.convertUtf8OffsetToUtf16(13)).eq(8);
    expect(str.convertUtf8OffsetToUtf16(14)).eq(9);
    expect(str.convertUtf8OffsetToUtf16(15)).eq(10);
  });

  it('mapping UTF-16 surrogate pairs ', () => {
    const str = new OnigString('1𩸽𩹀');

    expect(Array.from(str.utf8Bytes)).deep.eq([0x31, 0xf0, 0xa9, 0xb8, 0xbd, 0xf0, 0xa9, 0xb9, 0x80, 0x0]);
    expect(str.convertUtf16OffsetToUtf8(0)).eq(0);
    expect(str.convertUtf16OffsetToUtf8(1)).eq(1);
    expect(str.convertUtf16OffsetToUtf8(2)).eq(1);
    expect(str.convertUtf16OffsetToUtf8(3)).eq(5);
    expect(str.convertUtf16OffsetToUtf8(4)).eq(5);

    expect(str.convertUtf8OffsetToUtf16(0)).eq(0);
    expect(str.convertUtf8OffsetToUtf16(1)).eq(1);
    expect(str.convertUtf8OffsetToUtf16(2)).eq(1);
    expect(str.convertUtf8OffsetToUtf16(3)).eq(1);
    expect(str.convertUtf8OffsetToUtf16(4)).eq(1);
    expect(str.convertUtf8OffsetToUtf16(5)).eq(3);
    expect(str.convertUtf8OffsetToUtf16(6)).eq(3);
    expect(str.convertUtf8OffsetToUtf16(7)).eq(3);
    expect(str.convertUtf8OffsetToUtf16(8)).eq(3);
  });
});
