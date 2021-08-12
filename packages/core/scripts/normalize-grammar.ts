import * as path from 'path';
import * as fs from 'fs';
import {IRawRule, IRawGrammar} from '..'

const targetGrammar = require("@monaco-imposture-tools/grammars/azure/LogicApps.tmLanguage.json") as IRawGrammar;

function normalizeRule(root:IRawRule, namespaces:(string|number)[]){

  function normalizeCaptures(captureName:string, root:IRawRule, namespaces:(string|number)[]){
    if(root[captureName]){
      for(const key in root[captureName]){
        if (
          key !== '$impostureLang' &&
          key !== '$impostureLangMeta'
        ){
          normalizeRule(root[captureName][key], [...namespaces, captureName, key])
        }
      }
    }
  }

  namespaces = namespaces.slice();
  if (!root.$impostureLang){
    root.$impostureLang = {namespaces};
  }else{
    root.$impostureLang = {
      ...root.$impostureLang,
      namespaces
    };
  }
  normalizeCaptures('captures', root, namespaces);
  normalizeCaptures('beginCaptures', root, namespaces);
  normalizeCaptures('endCaptures', root, namespaces);
  normalizeCaptures('whileCaptures', root, namespaces);

  if (Array.isArray(root.patterns)){
    root.patterns.forEach((one, index) => {
      normalizeRule(one, [...namespaces, "patterns", index])
    })
  }

  if (root.repository){
    for(const key in root.repository){
      if (
        key !== '$self' &&
        key !== '$base' &&
        key !== '$impostureLang' &&
        key !== '$impostureLangMeta'
      ){
        normalizeRule(root.repository[key], [...namespaces, "repository", key])
      }
    }
  }
  return;
}

function normalizeGrammar(root:IRawGrammar){

  if (Array.isArray(root.patterns)){
    root.patterns.forEach((one, index) => {
      normalizeRule(one, ['patterns', index])
    })
  }

  if (root.repository){
    for(const key in root.repository){
      if (
        key !== '$self' &&
        key !== '$base' &&
        key !== '$impostureLang' &&
        key !== '$impostureLangMeta'
      ){
        normalizeRule(root.repository[key], ['repository', key])
      }
    }
  }

  if (root.injections){
    for(const key in root.injections){
      if (
        key !== '$self' &&
        key !== '$base' &&
        key !== '$impostureLang' &&
        key !== '$impostureLangMeta'
      ){
        normalizeRule(root.injections[key], ['injections', key])
      }
    }
  }

}

normalizeGrammar(targetGrammar);


if (!fs.existsSync(path.join(__dirname, '..', 'tmp'))) {
  fs.mkdirSync(path.join(__dirname, '..', 'tmp'));
}
fs.writeFileSync(
  path.join(__dirname, '..', 'tmp', 'LogicApps.tmLanguage.ext.json'),
  JSON.stringify(targetGrammar, null, 4)
)
