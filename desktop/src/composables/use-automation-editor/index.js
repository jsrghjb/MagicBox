/**
 * useAutomationEditor
 * Shared composable for both the dedicated /automation window
 * (pages/automation/App.vue) and the embedded automation view
 * (src/views/automation/index.vue).
 *
 * Returns state, editing actions, and run/import/export/AI helpers
 * so each UI only renders templates and binds events.
 *
 * @param {import('vue').Ref<string>|{value:string}} deviceIdRef
 *   reactive device id (may be empty for edit-only mode)
 */
import { useAutomationEditorState } from './state.js'
import { useAutomationEditorActions } from './editing.js'
import { useAutomationEditorRuns } from './runs.js'

export function useAutomationEditor(deviceIdRef) {
  const state = useAutomationEditorState(deviceIdRef)
  const ctx = { ...state, deviceId: deviceIdRef }
  const actions = useAutomationEditorActions(ctx)
  const runs = useAutomationEditorRuns(ctx)

  return { state, actions, runs, ctx }
}
