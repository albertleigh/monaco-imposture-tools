type UintArray = Uint8Array | Uint16Array | Uint32Array;

export class OnigUTF8String {
  private readonly source: string;
  private _utf8Bytes?: Uint8Array;

  /**
   * utf16-offset where the mapping table starts. Before that index: utf16-index === utf8-index
   */
  private _mappingTableStartOffset: number;
  /**
   * utf-16 to utf-8 mapping table for all uft-8 indexes starting at `_mappingTableStartOffset`. utf8-index are always starting at 0.
   * `null` if there are no multibyte characters in the utf8 string and all utf-8 indexes are matching the utf-16 indexes.
   * Example: _mappingTableStartOffset === 10, _utf16OffsetToUtf8 = [0, 3, 6] -> _utf8Indexes[10] = 10, _utf8Indexes[11] = 13
   */
  private _utf8Indexes?: UintArray;

  constructor(content: string) {
    if (typeof content !== 'string') {
      throw new TypeError('Argument must be a string');
    }
    this.source = content;
    this._utf8Bytes = undefined;
    this._utf8Indexes = undefined;
  }

  public get utf8Bytes(): Uint8Array {
    if (!this._utf8Bytes) {
      this.encode();
    }
    // todo do manually assert hover here ??
    return this._utf8Bytes!;
  }

  /**
   * Returns undefined if all utf8 offsets match utf-16 offset (content has no multi byte characters)
   */
  private get utf8Indexes(): UintArray | undefined {
    if (!this._utf8Bytes) {
      this.encode();
    }
    return this._utf8Indexes;
  }

  public get content(): string {
    return this.source;
  }

  public get length(): number {
    return this.source.length;
  }

  public substring(start, end) {
    return this.source.substring(start, end);
  }

  public toString() {
    return this.source;
  }

  public get hasMultiByteCharacters():boolean {
    return Boolean(this.utf8Indexes);
  }

  /**
   * ConvertUtf8OffsetToUtf16 in O(log n)
   * @param utf8Offset: offset of the utf8 string
   */
  public convertUtf8OffsetToUtf16(utf8Offset: number): number {
    if (utf8Offset < 0) {
      return 0;
    }
    const utf8Array = this._utf8Bytes;
    if (utf8Offset >= utf8Array!.length - 1) {
      return this.source.length;
    }

    const utf8OffsetMap = this.utf8Indexes;
    if (utf8OffsetMap && utf8Offset >= this._mappingTableStartOffset) {
      return (
        findFirstInSorted(utf8OffsetMap, utf8Offset - this._mappingTableStartOffset) + this._mappingTableStartOffset
      );
    }
    return utf8Offset;
  }

  /**
   * ConvertUtf8OffsetToUtf16 in O(1)
   * @param utf16Offset: offset of utf16 string
   */
  public convertUtf16OffsetToUtf8(utf16Offset: number): number {
    if (utf16Offset < 0) {
      return 0;
    }
    const utf8Array = this._utf8Bytes!;
    if (utf16Offset >= this.source.length) {
      return utf8Array.length - 1;
    }

    const utf8OffsetMap = this.utf8Indexes;
    if (utf8OffsetMap && utf16Offset >= this._mappingTableStartOffset) {
      return utf8OffsetMap[utf16Offset - this._mappingTableStartOffset] + this._mappingTableStartOffset;
    }
    return utf16Offset;
  }

  /**
   * Encode js utf-16 little endian string into utf-8 and populate it into unsigned char*  _utf8Bytes
   * Also populate _utf8Indexes & _mappingTableStartOffset if we need map the offset b/w to strings
   *
   * UTF ENCODING FORMATS
   * variable length:             utf-8, utf-16,
   * fixed length:                utf-32
   *    1 byte utf-8    [0x00, 0x7f]
   *    2 bytes utf-8   [0xc0_80, 0xdf_bf]
   *                    110_XXXXX 10_XXXXXX
   *                    comp. 0x1f3f
   *    3 bytes utf-8   [0xe0_80_80, 0xef_bf_bf]
   *                    1110_XXXX 10_XXXXXX 10_XXXXXX
   *    4 bytes utf-8   [0xf0_80_80_80, 0xf7_bf_bf_bf]
   *                    11110_XXXX 10_XXXXXX 10_XXXXXX 10_XXXXXX
   *    -----------------------------------------------------------------------
   *    2 bytes utf-16  [0x00_00, 0xff_ff]
   *                    XXXX_XXXX XXXX_XXXX
   *    4 bytes utf-16  [0xd8_00_dc_00, 0xd8_ff_df_ff]
   *                    110110_XX XXXX_XXXX 110111_XX XXXX_XXXX
   *                    comp. 0x03ff  0x03ff
   *    -----------------------------------------------------------------------
   *    4 bytes utf-32  [0x00_00_00_00, 0xff_ff_ff_ff]
   *                    XXXX_XXXX XXXX_XXXX XXXX_XXXX XXXX_XXXX
   *
   * U+FFFD   REPLACEMENT CHARACTER
   *
   * @private
   */
  private encode(): void {
    const str = this.source;
    const n = str.length;
    // maybe the starting position of first non-one-byte utf-8/ non-two-bytes utf-16
    let mappingTableStartOffset = 0;
    // maybe utf8Offset of utf16Offset: mappingTableStartOffset+i
    let utf16OffsetToUtf8: UintArray| undefined = undefined;
    // maybe utf-16 index starting from the mappingTableStartOffset
    let utf16Offset = 0;
    function createOffsetTable(startOffset: number) {
      const maxUtf8Len = (n - startOffset) * 3;
      if (maxUtf8Len <= 0xff) {
        utf16OffsetToUtf8 = new Uint8Array(n - startOffset);
      } else if (maxUtf8Len <= 0xffff) {
        utf16OffsetToUtf8 = new Uint16Array(n - startOffset);
      } else {
        utf16OffsetToUtf8 = new Uint32Array(n - startOffset);
      }
      mappingTableStartOffset = startOffset;
      utf16OffsetToUtf8[utf16Offset++] = 0;
    }

    // allocate max now plus one null termination chart \0
    const u8view = new Uint8Array(n * 3 + 1 );

    // current head pointer within the u8view arr
    let ptrHead = 0;
    // utf-16 characters count
    let i = 0;
    // for some reason, v8 is faster with str.length than using a variable (might be illusion)
    while (i < str.length) {
      let codepoint;
      // The charCodeAt() method returns an integer between 0 and 0xffff representing the UTF-16 code unit
      // at the given index.
      const c = str.charCodeAt(i);

      // populate utf16OffsetToUtf8 if needed for current i-th 2-byte utf16 char
      if (utf16OffsetToUtf8) {
        (utf16OffsetToUtf8 as UintArray)[utf16Offset++] = ptrHead - mappingTableStartOffset;
      }

      if (c < 0xd800 || c > 0xdfff) {
        // 2 bytes utf-16
        codepoint = c;
      } else if (c >= 0xdc00) {
        // invalid 3rd & 4th of 4 bytes utf-16, use replacement instead
        codepoint = 0xfffd; // replacement char
      } else {
        // 1st & 2nd of 4 bytes utf-16
        if (i === n - 1) {
          // reaching the end of string, missed 3rd & 4th, thus use replacement instead
          codepoint = 0xfffd;
        } else {
          const d = str.charCodeAt(i + 1);

          if (0xdc00 <= d && d <= 0xdfff) {
            // valid 3rd & 4th of 4 bytes utf-16, also known as surrogate chart
            if (!utf16OffsetToUtf8) {
              createOffsetTable(i);
            }

            const a = c & 0x3ff;
            const b = d & 0x3ff;

            codepoint = 0x10000 + (a << 10) + b;
            i += 1;
            // populate utf16OffsetToUtf8 for the first two of the 4-byte utf16 char
            utf16OffsetToUtf8![utf16Offset++] = ptrHead - mappingTableStartOffset;
          } else {
            // invalid 3rd & 4th of 4 bytes utf-16, use replacement char
            codepoint = 0xfffd;
          }
        }
      }

      let bytesRequiredToEncode: number;
      let offset: number;

      // determine the utf-8 formats
      if (codepoint <= 0x7f) {
        // 1 byte utf-8
        bytesRequiredToEncode = 1;
        offset = 0;
      } else if (codepoint <= 0x07ff) {
        // 2 bytes utf-8
        bytesRequiredToEncode = 2;
        offset = 0xc0;
      } else if (codepoint <= 0xffff) {
        // 3 bytes utf-8
        bytesRequiredToEncode = 3;
        offset = 0xe0;
      } else {
        // 4 bytes utf-8
        bytesRequiredToEncode = 4;
        offset = 0xf0;
      }

      // populate the u8view
      if (bytesRequiredToEncode === 1) {
        u8view[ptrHead++] = codepoint;
      } else {
        // alright we got a non-one-byte utf8, we need maintain
        if (!utf16OffsetToUtf8) {
          createOffsetTable(ptrHead);
        }
        u8view[ptrHead++] = (codepoint >> (6 * --bytesRequiredToEncode)) + offset;

        while (bytesRequiredToEncode > 0) {
          const temp = codepoint >> (6 * (bytesRequiredToEncode - 1));

          u8view[ptrHead++] = 0x80 | (temp & 0x3f);

          bytesRequiredToEncode -= 1;
        }
      }

      i += 1;
    }

    const utf8 = u8view.slice(0, ptrHead + 1);
    // populate \0 for c unsigned chart*
    utf8[ptrHead] = 0x00;

    this._utf8Bytes = utf8;
    if (utf16OffsetToUtf8) {
      // set if UTF-16 surrogate chars or multi-byte characters found
      this._utf8Indexes = utf16OffsetToUtf8;
      this._mappingTableStartOffset = mappingTableStartOffset;
    }
  }
}

function findFirstInSorted(array: UintArray, i: number): number {
  let low = 0;
  let high = array.length;

  if (high === 0) {
    return 0; // no children
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (array[mid] >= i) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  // low is on the index of the first value >= i or array.length. Decrement low until we find array[low] <= i
  while (low > 0 && (low >= array.length || array[low] > i)) {
    low--;
  }
  // check whether we are on the second index of a utf-16 surrogate char. If so, go to the first index.
  if (low > 0 && array[low] === array[low - 1]) {
    low--;
  }

  return low;
}

export default OnigUTF8String;
