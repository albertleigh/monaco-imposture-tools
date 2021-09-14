import {IOnigCaptureIndex} from '@monaco-imposture-tools/oniguruma-asm';

export function escapeRegExpCharacters(value: string): string {
  return value.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, '\\$&');
}

export function clone<T>(something: T): T {
  return doClone(something);
}

function doClone(something: any): any {
  if (Array.isArray(something)) {
    return cloneArray(something);
  }
  if (typeof something === 'object') {
    return cloneObj(something);
  }
  return something;
}

function cloneArray(arr: any[]): any[] {
  const r: any[] = [];
  for (let i = 0, len = arr.length; i < len; i++) {
    r[i] = doClone(arr[i]);
  }
  return r;
}

function cloneObj(obj: any): any {
  const r: any = {};
  for (const key in obj) {
    r[key] = doClone(obj[key]);
  }
  return r;
}

export function mergeObjects(target: any, ...sources: any[]): any {
  sources.forEach((source) => {
    for (const key in source) {
      target[key] = source[key];
    }
  });
  return target;
}

const CAPTURING_REGEX_SOURCE = /\$(\d+)|\${(\d+):\/(downcase|upcase)}/;

export class RegexSource {
  public static hasCaptures(regexSource: string): boolean {
    return CAPTURING_REGEX_SOURCE.test(regexSource);
  }

  public static replaceCaptures(
    regexSource: string,
    captureSource: string,
    captureIndices: IOnigCaptureIndex[]
  ): string {
    return regexSource.replace(
      CAPTURING_REGEX_SOURCE,
      (match: string, index: string, commandIndex: string, command: string) => {
        const capture = captureIndices[parseInt(index || commandIndex, 10)];
        if (capture) {
          let result = captureSource.substring(capture.start, capture.end);
          // Remove leading dots that would make the selector invalid
          while (result[0] === '.') {
            result = result.substring(1);
          }
          switch (command) {
            case 'downcase':
              return result.toLowerCase();
            case 'upcase':
              return result.toUpperCase();
            default:
              return result;
          }
        } else {
          return match;
        }
      }
    );
  }
}
