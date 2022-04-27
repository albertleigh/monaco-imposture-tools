import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {
  default as AzLogicAppExpressionLang,
  IdentifierType,
  AzLgcExpDocument,
  AzLogicAppExpressionLangMonacoEditor,
  ValidateResult,
  createPkgValDesc,
  createRefValDesc,
  createFunValDesc,
  createSymbolTable,
  createFunRetDesc,
  createOverloadedFunValDesc
} from 'monaco-azure-logic-app-lang';

AzLogicAppExpressionLang.scannerOrItsPath = `assets/scanner.wasm`;
AzLogicAppExpressionLang.monaco = monaco;
AzLogicAppExpressionLang.emitBinaryTokens = true;
AzLogicAppExpressionLang.inSyntaxDebugMode = true;
AzLogicAppExpressionLang.inSemanticDebugMode = true;

const sampleCodes = "";

export const MONACO_EDITOR_ID = 'first-expression-monaco-editor';

(window as any).ST_GENERATOR_SEED = 1;

function generateNextSymbolTable() {
  const nextSeed = (window as any).ST_GENERATOR_SEED++;
  return createSymbolTable(
    {
      [`dynamic${nextSeed}`]:createFunValDesc(
        [
          `**dynamic${nextSeed}()**`,
          `Dynamic function ${nextSeed}`
        ],
        [IdentifierType.CONSTANT(nextSeed)],
        IdentifierType.Number
      ),
      activity: createOverloadedFunValDesc([
          '***activity(activity name)***',
          'Retrieve an activity and its output.',
        ],
        [
          [IdentifierType.CONSTANT('Get Default 1')],
          [IdentifierType.CONSTANT('Get Default 2')],

          [IdentifierType.CONSTANT('Lookup 1 first row only')],
          [IdentifierType.CONSTANT('Lookup 2 first row only')],
          [IdentifierType.CONSTANT('Lookup 3')],
          [IdentifierType.CONSTANT('Lookup 4')],

          [IdentifierType.CONSTANT('GetFileMetadata 1')],
          [IdentifierType.CONSTANT('GetFileMetadata 2')],
          [IdentifierType.CONSTANT('GetFolderMetadata 1')],
          [IdentifierType.CONSTANT('GetFolderMetadata 2')],

          [IdentifierType.CONSTANT('Get Default 3')],
        ],
        [
          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'defaultActivity'], 'Activity return type'),
          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'defaultActivity'], 'Activity return type'),

          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'lookupActivity', 'firstRowOnly'], 'First-row-only lookup activity return type'),
          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'lookupActivity', 'firstRowOnly'], 'First-row-only lookup activity return type'),
          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'lookupActivity', 'defaultReturnValue'], 'Lookup activity return type'),
          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'lookupActivity', 'defaultReturnValue'], 'Lookup activity return type'),

          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'getMetaDataActivity', 'fileReturnValue'], 'File\'s getMetaData activity return type'),
          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'getMetaDataActivity', 'fileReturnValue'], 'File\'s getMetaData activity return type'),
          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'getMetaDataActivity', 'folderReturnValue'], 'Folder\'s getMetaData activity return type'),
          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'getMetaDataActivity', 'folderReturnValue'], 'Folder\'s getMetaData activity return type'),

          IdentifierType.FUNCTION_RETURN_TYPE(['activityPackage', 'defaultActivity'], 'Activity return type'),
        ]
      ),
      variables: createOverloadedFunValDesc([
          'Variable one',
          'Variable two',
          'Variable three',
          'stateItem',
          'splitStates',
        ],
        [
          [IdentifierType.CONSTANT('firstVar')],
          [IdentifierType.CONSTANT('secondVar')],
          [IdentifierType.CONSTANT('thirdVar')],
          [IdentifierType.CONSTANT('stateItem')],
          [IdentifierType.CONSTANT('splitStates')]
        ],
        [IdentifierType.String, IdentifierType.String, IdentifierType.String, IdentifierType.String, IdentifierType.Array]
      ),
      pipeline: createFunValDesc(
        ['**pipeline()**', 'Return pipeline object'],
        [],
        IdentifierType.FUNCTION_RETURN_TYPE(['pipeline'])
      ),
      item: createFunValDesc(
        ['**item()**', 'An item object returned'],
        [],
        IdentifierType.Any
      )
    },
    createFunRetDesc(
      createPkgValDesc([],{
        pipeline: createPkgValDesc(['**Return package pipeline**', 'Package pipeline'], {
          optionalPackage: createPkgValDesc(['Optional package', 'one demo purpose optional package'],
            {
              oneOptionalString: createRefValDesc(['oneOptionalString'], IdentifierType.String),
            },
            {optional:true}),
          Workspace: createRefValDesc(
            ['Name of the workspace run is running within'],
            IdentifierType.String,
            true
          ),
          DataFactory: createRefValDesc(
            ['Name of the data factory the pipeline run is running within'],
            IdentifierType.String
          ),
          Pipeline: createRefValDesc(['Pipeline Name'], IdentifierType.String),
          GroupId: createRefValDesc(['ID of the group to which the pipeline run belongs'], IdentifierType.String),
          RunId: createRefValDesc(['ID of the specific pipeline run'], IdentifierType.String),
          TriggerId: createRefValDesc(['ID of the trigger that invokes the pipeline'], IdentifierType.String),
          TriggerName: createRefValDesc(['Name of the trigger that invokes the pipeline'], IdentifierType.String),
          TriggerTime: createRefValDesc(
            [
              'Time when the trigger that invoked the pipeline. The trigger time is the actual fired time, not the scheduled time. For example, 13:20:08.0149599Z is returned instead of 13:20:00.00Z',
            ],
            IdentifierType.String
          ),
          TriggerType: createRefValDesc(
            ['Type of the trigger that invoked the pipeline (Manual, Scheduler)'],
            IdentifierType.String
          ),
          TriggeredByPipelineName: createRefValDesc(
            [
              'Name of the pipeline that triggered this pipeline. Applicable when a pipeline run is triggered by an Execute Pipeline activity; Evaluates to Null when used in other circumstances.',
            ],
            IdentifierType.String,
            true
          ),
          TriggeredByPipelineRunId: createRefValDesc(
            [
              'Run ID of the pipeline that triggered this pipeline. Applicable when a pipeline run is triggered by an Execute Pipeline activity; Evaluates to Null when used in other circumstances.',
            ],
            IdentifierType.String,
            true
          ),
          globalParameters: createPkgValDesc(
            [
              'Global parameter package'
            ],
            {
              firstGlobalStrPara: createRefValDesc(['firstGlobalStrPara'], IdentifierType.String),
              oneGlobalNumber: createRefValDesc(['oneGlobalNumber'], IdentifierType.Number),
              oneGlobalFloat: createRefValDesc(['oneGlobalNumber'], IdentifierType.Number),
              oneGlobalBoolean: createRefValDesc(['oneGlobalNumber'], IdentifierType.Boolean),
              oneGlobalArr: createRefValDesc(['oneGlobalNumber'], IdentifierType.Array, true, []),
              oneGlobalObj: createRefValDesc(['oneGlobalObj'], IdentifierType.AnyObject, true, {}),
              oneTypedObj: createPkgValDesc(['oneTypedObj'], {
                anotherStrPara: createRefValDesc(['anotherStrPara'], IdentifierType.String),
                anotherGlobalNumber: createRefValDesc(['anotherGlobalNumber'], IdentifierType.Number),
                anotherGlobalFloat: createRefValDesc(['anotherGlobalFloat'], IdentifierType.Number),
                anotherGlobalBoolean: createRefValDesc(['anotherGlobalBoolean'], IdentifierType.Boolean),
                anotherGlobalArr: createRefValDesc(['anotherGlobalArr'], IdentifierType.Array, true, []),
                anotherGlobalObj: createRefValDesc(['anotherGlobalObj'], IdentifierType.AnyObject, true, {}),
              }),
            }
          )
        }),
        activityPackage: createPkgValDesc([], {
          defaultActivity:createPkgValDesc(['**Return package activity**', 'Package activity'], {
            output: createRefValDesc(
              [
                '***output:any***',
                'Activity output'
              ],
              IdentifierType.Any
            )
          }, {allowAdditionalAnyProperties: true}),
          lookupActivity:createPkgValDesc(['Package Lookup activity'], {
            rowItem: createRefValDesc([
              '***rowItem:any***',
              'data of the first row'
            ], IdentifierType.Any),
            defaultReturnValue:createPkgValDesc(['**Return value of a lookup activity**', 'Lookup activity'], {
              output: createPkgValDesc(
                [
                  '***output:any & { count, value }***',
                  'Lookup activity output'
                ],
                {
                  count: createRefValDesc([
                    '***count:number***',
                    'count of the row'
                  ], IdentifierType.Number),
                  value: createRefValDesc([
                    '***value:any[]***',
                    'array of row data'
                  ], IdentifierType.ARRAY_OF_TYPE(['activityPackage', 'lookupActivity', 'rowItem'], 'row data value'))
                },  {allowAdditionalAnyProperties: true}
              )
            }, {allowAdditionalAnyProperties: true}),
            firstRowOnly:createPkgValDesc(['**Return value of a lookup activity[firstRowOnly]**', 'Lookup activity for the first only'], {
              output: createPkgValDesc(
                [
                  '***output:any &{ firstRow }***',
                  'First-row-only lookup activity output'
                ],
                {
                  firstRow: createRefValDesc([
                    '***firstRow:any***',
                    'data of the first row'
                  ], IdentifierType.Any)
                },  {allowAdditionalAnyProperties: true}
              )
            }, {allowAdditionalAnyProperties: true}),
          }),
          getMetaDataActivity:createPkgValDesc(['Package GetMetadata activity'], {
            itemType: createPkgValDesc(['Medata item type'], {
              name: createRefValDesc(['name of the item'], IdentifierType.String),
              type: createRefValDesc(['type of the item data'], IdentifierType.String),
            },{allowAdditionalAnyProperties: true}),
            defaultReturnValue:createPkgValDesc(['**Return value of a getMetadata activity**', 'GetMetadata activity'], {
              output: createPkgValDesc(
                [
                  '***output:any***',
                  'GetMetadata activity output'
                ],
                {
                  exists: createRefValDesc(
                    [
                      '***exists:boolean***',
                      "Whether a file, folder, or table exists. If exists is specified in the Get Metadata field list, the activity won't fail even if the file, folder, or table doesn't exist. Instead, exists: false is returned in the output."
                    ],
                    IdentifierType.Boolean
                  ),
                  itemName: createRefValDesc([
                    '***itemName:string***',
                    'Name of the file or folder.'
                  ], IdentifierType.String),
                  itemType: createRefValDesc([
                    '***itemType:string***',
                    "Type of the file or folder. Returned value is File or Folder."
                  ], IdentifierType.String),
                  size: createRefValDesc([
                    '***size:number***',
                    "Size of the file, in bytes. Applicable only to files."
                  ], IdentifierType.Number),
                  columnCount: createRefValDesc([
                    '***columnCount:number***',
                    "Number of columns in the file or relational table."
                  ], IdentifierType.Number),
                  lastModified: createRefValDesc([
                    '***lastModified:string***',
                    "Last modified datetime of the file or folder."
                  ], IdentifierType.String),
                  created: createRefValDesc([
                    '***created:string***',
                    'Created datetime of the file or folder.'
                  ], IdentifierType.String),
                  contentMD5: createRefValDesc([
                    '***contentMD5:string***',
                    'MD5 of the file. Applicable only to files.'
                  ], IdentifierType.String),
                  structure: createRefValDesc(
                    [
                      '***structure:{name, type}[]***',
                      'Data structure of the file or relational database table. Returned value is a list of column names and column types.'
                    ],
                    IdentifierType.ARRAY_OF_TYPE(['activityPackage', 'getMetaDataActivity', 'itemType'], 'structure return type')
                  ),
                  childItems: createRefValDesc(
                    [
                      '***childItems:{name, type}[]***',
                      "List of subfolders and files in the given folder. Applicable only to folders. Returned value is a list of the name and type of each child item."
                    ],
                    IdentifierType.ARRAY_OF_TYPE(['activityPackage', 'getMetaDataActivity', 'itemType'], 'childItems return type')
                  )
                },  {allowAdditionalAnyProperties: true}
              )
            }, {allowAdditionalAnyProperties: true}),
            fileReturnValue: createPkgValDesc(['**Return value of a getMetadata activity**', 'File\'s getMetadata activity'], {
              output: createPkgValDesc(
                [
                  'output:any',
                  'GetMetadata activity output'
                ],
                {
                  exists: createRefValDesc(
                    [
                      'exists:boolean',
                      'Whether a file, folder, or table exists. If exists is specified in the Get Metadata field list, the activity won\'t fail even if the file, folder, or table doesn\'t exist. Instead, exists: false is returned in the output.'
                    ],
                    IdentifierType.Boolean
                  ),
                  itemName: createRefValDesc([
                    'itemName:string',
                    'Name of the file or folder.'
                  ], IdentifierType.String),
                  itemType: createRefValDesc([
                    'itemType:string',
                    'Type of the file or folder. Returned value is File or Folder.'
                  ], IdentifierType.String),
                  size: createRefValDesc([
                    'size:number',
                    'Size of the file, in bytes. Applicable only to files.'
                  ], IdentifierType.Number),
                  lastModified: createRefValDesc([
                    'lastModified:string',
                    'Last modified datetime of the file or folder.'
                  ], IdentifierType.String),
                  created: createRefValDesc([
                    'created:string',
                    'Created datetime of the file or folder.'
                  ], IdentifierType.String),
                  contentMD5: createRefValDesc([
                    'contentMD5:string',
                    'MD5 of the file. Applicable only to files.'
                  ], IdentifierType.String),
                  structure: createRefValDesc(
                    [
                      'structure:{name, type}[]',
                      'Data structure of the file or relational database table. Returned value is a list of column names and column types.'
                    ],
                    IdentifierType.ARRAY_OF_TYPE(['activityPackage', 'getMetaDataActivity', 'itemType'], 'structure return type')
                  ),
                  columnCount: createRefValDesc([
                    'columnCount:number',
                    'Number of columns in the file or relational table.'
                  ], IdentifierType.Number)
                },  {allowAdditionalAnyProperties: true}
              )
            }, {allowAdditionalAnyProperties: true}),
            folderReturnValue: createPkgValDesc(['**Return value of a getMetadata activity**', 'Folder\'s getMetadata activity'], {
              output: createPkgValDesc(
                [
                  'output:any',
                  'GetMetadata activity output'
                ],
                {
                  exists: createRefValDesc(
                    [
                      'exists:boolean',
                      'Whether a file, folder, or table exists. If exists is specified in the Get Metadata field list, the activity won\'t fail even if the file, folder, or table doesn\'t exist. Instead, exists: false is returned in the output.'
                    ],
                    IdentifierType.Boolean
                  ),
                  itemName: createRefValDesc([
                    'itemName:string',
                    'Name of the file or folder.'
                  ], IdentifierType.String),
                  itemType: createRefValDesc([
                    'itemType:string',
                    'Type of the file or folder. Returned value is File or Folder.'
                  ], IdentifierType.String),
                  lastModified: createRefValDesc([
                    'lastModified:string',
                    'Last modified datetime of the file or folder.'
                  ], IdentifierType.String),
                  created: createRefValDesc([
                    'created:string',
                    'Created datetime of the file or folder.'
                  ], IdentifierType.String),
                  childItems: createRefValDesc(
                    [
                      'childItems:{name, type}[]',
                      'List of subfolders and files in the given folder. Applicable only to folders. Returned value is a list of the name and type of each child item.'
                    ],
                    IdentifierType.ARRAY_OF_TYPE(['activityPackage', 'getMetaDataActivity', 'itemType'], 'childItems return type')
                  )
                },  {allowAdditionalAnyProperties: true}
              )
            }, {allowAdditionalAnyProperties: true})
          })
        }),
      })
    )
  );
}

const rootSymbolTable = generateNextSymbolTable();

function subscribeCodeDoc(azLgcExpDocument?: AzLgcExpDocument) {
  if (azLgcExpDocument) {
    (window as any).expCodeDocument = azLgcExpDocument.codeDocument;
    (window as any).expCodeDocumentText = azLgcExpDocument.codeDocument.text;
  }
}

function subscribeValidateResult(vr?: ValidateResult) {
  (window as any).expProblems = vr?.problems || [];
}

export const mount = (root:HTMLDivElement)=> {
  // noop
  const theEditor = new AzLogicAppExpressionLangMonacoEditor(
    root,
    {
      // theme: 'vs',
      theme: 'hc-black',
      // theme: 'vs-code-theme-converted',
      // readOnly: true,
      contextmenu: false,
      value: sampleCodes,
      automaticLayout: true,
    },
    MONACO_EDITOR_ID,
    rootSymbolTable
  )
  AzLogicAppExpressionLangMonacoEditor.init?.then(()=>{
    theEditor.azLgcExpDocEventEmitter?.subscribe(subscribeCodeDoc);
    theEditor.validationResultEventEmitter?.subscribe(subscribeValidateResult);
    (window as any).regenerateNextSymbolTable = function () {
      theEditor.rootSymbolTable = generateNextSymbolTable();
    };
    (window as any).manuallySetModelText = function (text:string) {
      theEditor.standaloneCodeEditor.getModel()?.setValue(text);
    };
  })
}
