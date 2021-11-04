import * as path from 'path';
import * as fs from 'fs';
import {IRawRule, IRawGrammar, IRawCaptures, IRawRepository, IRawRepositoryMap} from '..';
import {mergeObjects} from "../src/utils";


const FULL_PATH = false;
const nodeDict:Map<string, Node> = new Map<string, Node>();
const targetGrammar = require("@monaco-imposture-tools/grammars/javascript/JavaScript.tmLanguage.json") as IRawGrammar;
const grammarRepo:IRawRepository = targetGrammar.repository;

class Node {

  static createNewNode(name:string,rule:IRawRule):Node{
    if (!nodeDict.has(name)){
      const theNode = new Node(name, rule);
      nodeDict.set(name, theNode);
      theNode.init();
    }
    return nodeDict.get(name);
  }

  captures:Record<string, string> = {};
  beginCaptures:Record<string, string> = {};
  whileCaptures:Record<string, string> = {};
  patterns: string[] = [];
  repository:Record<string, string> = {};
  found:boolean = false;

  constructor(
    public name:string,
    public rule:IRawRule
  ) {
  }

  init(){
    let repository = grammarRepo;
    if (this.rule.repository){
      repository = mergeObjects({}, repository, this.rule.repository)
    }

    this.rule.patterns?.forEach(pattern => {
      if (pattern.include) {
        if (pattern.include.charAt(0) === '#') {
          let localIncludedRule = repository[pattern.include.substr(1)];
          Node.createNewNode(pattern.include, localIncludedRule);
          this.patterns.push(pattern.include);
        }
      }
    })
    populateCaptures(this, "captures");
    populateCaptures(this, "beginCaptures");
    populateCaptures(this, "whileCaptures");
    populateCaptures(this, "repository");
  }
}

function populateCaptures(
  parentNode: Node,
  captureName: "captures" | "beginCaptures" | "whileCaptures" | "repository"
){
  const targetDict = parentNode[captureName];
  const captures:IRawCaptures| IRawRepositoryMap = parentNode.rule[captureName];
  if (captures){
    for (const key in captures){
      if (
        key !== '$self' &&
        key !== '$base' &&
        key !== '$impostureLang' &&
        key !== '$impostureLangMeta'
      ){
        const newRuleName = `[${parentNode.name}]::${captureName}-${key}`;
        Node.createNewNode(newRuleName, captures[key]);
        targetDict[key] = newRuleName;
      }
    }
  }
}

function initGrammar(grammar:IRawGrammar):Node[]{
  const result:Node[] = [];

  grammar.patterns.forEach(pattern => {
    if (pattern.include) {
      if (pattern.include.charAt(0) === '#') {
        let localIncludedRule = grammarRepo[pattern.include.substr(1)];
        result.push(Node.createNewNode(pattern.include, localIncludedRule));
      }
    }
  })

  return result
}


function findByPatternName(targetPatterName:string) {
  const allNodes = initGrammar(targetGrammar);
  const resultPaths: string[][] = [];

  function doSearch(node:Node, currentPath:string[]):boolean{
    let found = false;
    if (node.name === targetPatterName) {
      resultPaths.push(currentPath);
      node.found = true;
      return true;
    }
    node.patterns.forEach((pattern, index) => {
      if (nodeDict.has(pattern) && currentPath.indexOf(pattern) === -1){
        let theNode = nodeDict.get(pattern);
        if (!FULL_PATH && theNode.found){
          resultPaths.push([...currentPath, `pattern:${index}`, pattern]);
          found = true;
        }else{
          found = found || doSearch(theNode, [...currentPath, `pattern:${index}`, pattern])
        }
      }
    });
    ['captures', 'beginCaptures', 'whileCaptures', 'repository'].forEach(field => {
      for (const onePatternKey in node[field]){
        const onePattern = node[field][onePatternKey];
        if (nodeDict.has(onePattern)){
          let theNode = nodeDict.get(onePattern);
          if (!FULL_PATH && theNode.found){
            resultPaths.push([...currentPath, onePattern]);
            found = true;
          }else{
            found = found || doSearch(theNode, [...currentPath, onePattern])
          }
        }
      }
    })
    node.found = found;
  }

  allNodes.forEach(rootNode => {
    doSearch(rootNode, [rootNode.name])
  })

  return resultPaths;
}

const result = findByPatternName('#identifiers');
const csvArray:string[]= [];

result.forEach((oneArr, index)=>{
  const line = oneArr.join(',');
  csvArray.push(line);
})

fs.writeFileSync(
  path.join(__dirname, '..', 'tmp', 'print_rules.csv'),
  csvArray.join('\n')
)
