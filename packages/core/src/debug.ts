const debug = {
  CAPTURE_METADATA: typeof process === 'undefined' ? false : !!process.env['VSCODE_TEXTMATE_DEBUG'],
  IN_DEBUG_MODE: typeof process === 'undefined' ? false : !!process.env['VSCODE_TEXTMATE_DEBUG']
};
export default debug