import * as React from 'react'
import type { Location, Position, Range } from 'vscode-languageserver-protocol'

import { CapabilityContext, EditorContext, VersionContext } from '../contexts'
import { WithRpcSessions } from '../rpcSessions'
import { ServerVersion } from '../serverVersion'
import { mapRpcError, useEventResult } from '../util'
import type { InteractiveGoalSnapshot, InteractiveGoalState } from './rpc'
import { useGoalSnapshot } from './useGoalSnapshot'
import { useSourceHighlight } from './useSourceHighlight'

function formatPosition(position: Position): string {
    return `${position.line + 1}:${position.character + 1}`
}

function formatRange(range: Range | undefined): string {
    if (!range) return 'Not available'
    return `${formatPosition(range.start)}–${formatPosition(range.end)}`
}

function StateScope({ state, index }: { state: InteractiveGoalState; index: number }) {
    const headingId = `experimental-goal-state-${index}`
    return (
        <section className="experimental-infoview__scope" aria-labelledby={headingId}>
            <h2 id={headingId}>Selected tactic state {index + 1}</h2>
            <dl>
                <div>
                    <dt>Declaration</dt>
                    <dd>{state.declaration ? <code>{state.declaration.name}</code> : 'Not a named declaration'}</dd>
                </div>
                <div>
                    <dt>Declaration range</dt>
                    <dd>{formatRange(state.declaration?.range)}</dd>
                </div>
                <div>
                    <dt>Name range</dt>
                    <dd>{formatRange(state.declaration?.selectionRange)}</dd>
                </div>
                <div>
                    <dt>Tactic range</dt>
                    <dd>{formatRange(state.tacticRange)}</dd>
                </div>
                <div>
                    <dt>Proof state</dt>
                    <dd>{state.useAfter ? 'After this tactic' : 'Before this tactic'}</dd>
                </div>
                <div>
                    <dt>Goals</dt>
                    <dd>{state.goals.goals.length}</dd>
                </div>
            </dl>
        </section>
    )
}

function Snapshot({ snapshot }: { snapshot: InteractiveGoalSnapshot }) {
    return (
        <div className="experimental-infoview__snapshot">
            <section className="experimental-infoview__scope" aria-labelledby="experimental-query-heading">
                <h2 id="experimental-query-heading">Query context</h2>
                <dl>
                    <div>
                        <dt>Cursor position</dt>
                        <dd>{formatPosition(snapshot.queryPosition)}</dd>
                    </div>
                    <div>
                        <dt>Command range</dt>
                        <dd>{formatRange(snapshot.commandRange)}</dd>
                    </div>
                </dl>
            </section>
            {snapshot.states.length === 0 ? (
                <p className="experimental-infoview__empty">No tactic proof state was selected at this position.</p>
            ) : (
                snapshot.states.map((state, index) => <StateScope key={index} state={state} index={index} />)
            )}
        </div>
    )
}

function ExperimentalGoalSnapshot({ location }: { location: Location }) {
    const result = useGoalSnapshot(location)
    useSourceHighlight(location, result)
    if (result.state === 'loading') {
        return <p role="status">Reading the scoped proof state from Lean…</p>
    }
    if (result.state === 'rejected') {
        return (
            <section className="experimental-infoview__notice" aria-labelledby="experimental-rpc-error">
                <h2 id="experimental-rpc-error">Unable to read the proof state</h2>
                <p>{mapRpcError(result.error).message}</p>
            </section>
        )
    }
    if (!result.value) {
        return (
            <section className="experimental-infoview__notice" aria-labelledby="experimental-rpc-unavailable">
                <h2 id="experimental-rpc-unavailable">Scoped proof states are unavailable</h2>
                <p>The open Lean file does not provide the experimental Infoview RPC.</p>
            </section>
        )
    }
    return <Snapshot snapshot={result.value} />
}

export function ExperimentalInfoview() {
    const editor = React.useContext(EditorContext)
    const location = useEventResult(editor.events.changedCursorLocation)
    const initialization = useEventResult(editor.events.serverRestarted)
    const serverStopped = useEventResult(editor.events.serverStopped)
    const version = initialization ? ServerVersion.ofString(initialization.serverInfo?.version ?? '') : undefined

    let content: React.ReactNode
    if (serverStopped) {
        content = <p>{serverStopped.message}</p>
    } else if (!initialization || !version) {
        content = <p role="status">Waiting for the Lean server…</p>
    } else if (!location) {
        content = <p>Place the cursor in a Lean file to inspect its proof state.</p>
    } else {
        content = (
            <CapabilityContext.Provider value={initialization.capabilities}>
                <VersionContext.Provider value={version}>
                    <WithRpcSessions>
                        <ExperimentalGoalSnapshot location={location} />
                    </WithRpcSessions>
                </VersionContext.Provider>
            </CapabilityContext.Provider>
        )
    }

    return (
        <main className="experimental-infoview" aria-labelledby="experimental-infoview-title">
            <div className="experimental-infoview__introduction">
                <h1 id="experimental-infoview-title">Experimental Infoview</h1>
                <p>The experimental renderer is showing the source scope selected by Lean.</p>
            </div>
            {content}
        </main>
    )
}
