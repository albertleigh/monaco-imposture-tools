import {Range} from "monaco-azure-logic-app-lang";

export function findDeepestRangeBy(root:any, namespaces:(string|null)[]): Range|undefined {
  let result:Range|undefined = undefined;
  let workingNode:any = root;

  namespaces = namespaces.slice();

  while (namespaces.length){
    if (!workingNode || !namespaces[0]) break;
    workingNode = workingNode[namespaces.shift()!];
    if (
      workingNode['$impostureLangMeta']?.range
    ){
      const rangeInMeta = workingNode['$impostureLangMeta']?.range;
      result = Range.create(
        rangeInMeta.start.line,
        rangeInMeta.start.character,
        rangeInMeta.end.line,
        rangeInMeta.end.character,
      )
    }
  }

  return result;
}