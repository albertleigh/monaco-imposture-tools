import {OnigScanner, IOnigCaptureIndex} from './OnigScanner';
import {OnigUTF8String} from './OnigUTF8String';

export interface IOnigSearchResult extends IOnigCaptureIndex {
  match: string;
}

export class OnigRegExp {
  private readonly source: string;
  private scanner: OnigScanner;
  /**
   * Create a new regex with the given pattern
   * @param source A string pattern
   */
  constructor(source: string) {
    this.source = source;
    if (typeof source === 'boolean'){
      this.scanner = new OnigScanner([''+this.source]);
    }else{
      this.scanner = new OnigScanner([this.source]);
    }
  }

  /**
   * Synchronously search the string for a match starting at the given position
   * @param string The string to search
   * @param startPosition The optional position to start the search at, defaults to `0`
   */
  public searchSync(string: string | OnigUTF8String, startPosition?: number): IOnigSearchResult[] {
    if (startPosition == null) {
      startPosition = 0;
    }
    const match = this.scanner.findNextMatchSync(string, startPosition);
    return this.captureIndicesForMatch(string, match);
  }

  /**
   * Search the string for a match starting at the given position
   * @param string The string to search
   * @param startPosition The optional position to start the search at, defaults to `0`
   * @param callback The `(error, match)` function to call when done, match will be null if no matches were found. match will be an array of objects for each matched group on a successful search
   */
  public search(
    string: string | OnigUTF8String,
    startPosition?: number,
    callback?: (error: any, match?: IOnigSearchResult[]) => void
  ) {
    if (startPosition == null) {
      startPosition = 0;
    }
    if (typeof startPosition === 'function') {
      callback = startPosition;
      startPosition = 0;
    }
    if (callback){
      try {
        const ret = this.searchSync(string, startPosition);
        callback(undefined, ret);
      } catch (error) {
        callback(error);
      }
    }
  }

  /**
   * Synchronously test if this regular expression matches the given string
   * @param string The string to test against
   */
  public testSync(string: string | OnigUTF8String | boolean): boolean {
    if (typeof this.source === 'boolean' || typeof string === 'boolean') {
      return this.source === string;
    }
    return Boolean(this.searchSync(string));
  }

  /**
   * Test if this regular expression matches the given string
   * @param string The string to test against
   * @param callback The (error, matches) function to call when done, matches will be true if at least one match is found, false otherwise
   */
  public test(string: string | OnigUTF8String, callback?: (error: any, matches?: boolean) => void) {
    if (typeof callback !== 'function') {
      callback = () => {};
    }
    try {
      callback(undefined, this.testSync(string));
    } catch (error) {
      callback(error);
    }
  }

  private captureIndicesForMatch(str: string | OnigUTF8String, match) {
    if (Boolean(match)) {
      const {captureIndices} = match;
      let capture;
      str = this.scanner.convertToString(str);
      for (let i = 0; i < captureIndices.length; i++) {
        capture = captureIndices[i];
        capture.match = str.slice(capture.start, capture.end);
      }
      return captureIndices;
    } else {
      return undefined;
    }
  }
}

export default OnigRegExp;
