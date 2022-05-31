import {IRawGrammar} from './types';
import debug from './debug';
import {parse as manualParseJSON} from './json';

export function parseJSONGrammar(contents: string, filename: string): IRawGrammar {
  if (debug.CAPTURE_METADATA) {
    return <IRawGrammar>manualParseJSON(contents, filename, true);
  }
  return <IRawGrammar>JSON.parse(contents);
}