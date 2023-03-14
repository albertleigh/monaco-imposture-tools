import {CancellationToken, editor, languages, Range} from './editor.api';
import {ErrorCode} from './validateHelper';

function errCodeStr(code: ErrorCode) {
  return '' + code;
}


function collect_for_NEED_PRECEDING_SEPARATOR(
  model: editor.ITextModel,
  range: Range,
  context: languages.CodeActionContext,
  token: CancellationToken,
  actions: languages.CodeAction[],
  maker: editor.IMarkerData
) {
  if (maker.code === errCodeStr(ErrorCode.NEED_PRECEDING_SEPARATOR)) {
    const prependedAtSymbol = model.getValueInRange({
      startLineNumber: maker.startLineNumber,
      startColumn: maker.startColumn - 1,
      endLineNumber: maker.startLineNumber,
      endColumn: maker.startColumn,
    });
    const theStartCol = prependedAtSymbol === '@' ? maker.startColumn - 1 : maker.startColumn;
    actions.push({
      title: `Prepend a comma`,
      diagnostics: [maker],
      kind: 'quickfix',
      edit: {
        edits: [
          {
            resource: model.uri,
            textEdit: {
              range: {
                startLineNumber: maker.startLineNumber,
                startColumn: theStartCol,
                endLineNumber: maker.startLineNumber,
                endColumn: theStartCol,
              },
              text: ', ',
            },
            versionId: model.getVersionId()
          },
        ],
      },
      isPreferred: true,
    });
  }
}

function collect_for_IDENTIFIER_ACCESSOR_NEED_NOT_BE_OPTIONAL(
  model: editor.ITextModel,
  range: Range,
  context: languages.CodeActionContext,
  token: CancellationToken,
  actions: languages.CodeAction[],
  maker: editor.IMarkerData
) {
  if (maker.code === errCodeStr(ErrorCode.IDENTIFIER_ACCESSOR_NEED_NOT_BE_OPTIONAL)) {
    const optionalAccessor = model.getValueInRange({
      startLineNumber: maker.startLineNumber,
      startColumn: maker.startColumn,
      endLineNumber: maker.startLineNumber,
      endColumn: maker.startColumn + 1,
    });
    if (optionalAccessor === '?') {
      actions.push({
        title: `Remove redundant optional accessor`,
        diagnostics: [maker],
        kind: 'quickfix',
        edit: {
          edits: [
            {
              resource: model.uri,
              textEdit: {
                range: {
                  startLineNumber: maker.startLineNumber,
                  startColumn: maker.startColumn,
                  endLineNumber: maker.startLineNumber,
                  endColumn: maker.startColumn + 1,
                },
                text: '',
              },
              versionId: model.getVersionId(),
            },
          ],
        },
        isPreferred: true,
      });
    }
  }
}

function collect_for_MISMATCHED_CASES_FOUND(
  model: editor.ITextModel,
  range: Range,
  context: languages.CodeActionContext,
  token: CancellationToken,
  actions: languages.CodeAction[],
  maker: editor.IMarkerData
) {
  if (maker.code === errCodeStr(ErrorCode.MISMATCHED_CASES_FOUND)) {

    if (typeof maker.source === 'string' && maker.source) {
      actions.push({
        title: `Rename into ${maker.source}`,
        diagnostics: [maker],
        kind: 'quickfix',
        edit: {
          edits: [
            {
              resource: model.uri,
              textEdit: {
                range: {
                  startLineNumber: maker.startLineNumber,
                  startColumn: maker.startColumn,
                  endLineNumber: maker.endLineNumber,
                  endColumn: maker.endColumn,
                },
                text: maker.source,
              },
              versionId: model.getVersionId(),
            },
          ],
        },
        isPreferred: true,
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateCodeActions(
  model: editor.ITextModel,
  range: Range,
  context: languages.CodeActionContext,
  token: CancellationToken
): languages.ProviderResult<languages.CodeActionList> {

  const actions: languages.CodeAction[] = [];

  context.markers.forEach(value => {
    if (typeof value.code === 'string') {
      const codeNumber = parseInt(value.code, 10);
      if (!isNaN(codeNumber)) {
        switch (codeNumber) {
          case ErrorCode.NEED_PRECEDING_SEPARATOR:
            collect_for_NEED_PRECEDING_SEPARATOR(model, range, context, token, actions, value);
            break;
          case ErrorCode.MISMATCHED_CASES_FOUND:
            collect_for_MISMATCHED_CASES_FOUND(model, range, context, token, actions, value);
            break;
          case ErrorCode.IDENTIFIER_ACCESSOR_NEED_NOT_BE_OPTIONAL:
            collect_for_IDENTIFIER_ACCESSOR_NEED_NOT_BE_OPTIONAL(model, range, context, token, actions, value);
            break;
          default:
            // noop
            break;
        }
      }
    }
  })

  return {
    actions,
    dispose: () => {
    },
  } as languages.CodeActionList;
}
