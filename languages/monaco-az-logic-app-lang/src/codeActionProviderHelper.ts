import {CancellationToken, editor, languages, Range} from './editor.api';
import {ErrorCode} from './validateHelper';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateCodeActions(
  model: editor.ITextModel,
  range: Range,
  context: languages.CodeActionContext,
  token: CancellationToken
): languages.ProviderResult<languages.CodeActionList> {
  const actions: languages.CodeAction[] = context.markers
    // todo support more errors
    .filter((value) => value.code === '' + ErrorCode.NEED_PRECEDING_SEPARATOR)
    .map((error) => {
      const prependedAtSymbol = model.getValueInRange({
        startLineNumber: error.startLineNumber,
        startColumn: error.startColumn - 1,
        endLineNumber: error.startLineNumber,
        endColumn: error.startColumn,
      });
      const theStartCol = prependedAtSymbol === '@' ? error.startColumn - 1 : error.startColumn;
      return {
        title: `Prepend a comma`,
        diagnostics: [error],
        kind: 'quickfix',
        edit: {
          edits: [
            {
              resource: model.uri,
              edit: {
                range: {
                  startLineNumber: error.startLineNumber,
                  startColumn: theStartCol,
                  endLineNumber: error.startLineNumber,
                  endColumn: theStartCol,
                },
                text: ', ',
              },
            },
          ],
        },
        isPreferred: true,
      };
    });
  return {
    actions,
    dispose: () => {},
  } as languages.CodeActionList;
}
