import path from 'node:path'

// Where Projects and app-settings.json live: next to the program. In development that is the project folder; a
// portable exe unpacks itself to a temporary folder, so it reports its real location in PORTABLE_EXECUTABLE_DIR.
export function resolveDataRoot({ isPackaged, env = process.env, execPath = process.execPath, devRoot }) {
  if (!isPackaged) return devRoot
  return env.PORTABLE_EXECUTABLE_DIR || path.dirname(execPath)
}
