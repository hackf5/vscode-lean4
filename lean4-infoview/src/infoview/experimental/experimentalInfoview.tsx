import * as React from 'react'
import type { Location, Range } from 'vscode-languageserver-protocol'

import { CapabilityContext, EditorContext, EnvPosContext, VersionContext } from '../contexts'
import { WithRpcSessions } from '../rpcSessions'
import { ServerVersion } from '../serverVersion'
import { mapRpcError, useEventResult } from '../util'
import { ProofStateCard } from './proofStateCard'
import type { InteractiveGoalSnapshot, InteractiveGoalState } from './rpc'
import { useGoalSnapshot } from './useGoalSnapshot'
import { useSourceHighlight } from './useSourceHighlight'

function rangeKey(range: Range | undefined): string {
    if (!range) return 'no-range'
    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`
}

function stateKeyBase(state: InteractiveGoalState): string {
    return [
        rangeKey(state.tacticRange),
        state.useAfter ? 'after' : 'before',
        state.declaration?.name ?? 'command',
    ].join('|')
}

function keyedStates(states: InteractiveGoalState[]): { key: string; state: InteractiveGoalState }[] {
    const occurrences = new Map<string, number>()
    return states.map(state => {
        const base = stateKeyBase(state)
        const occurrence = occurrences.get(base) ?? 0
        occurrences.set(base, occurrence + 1)
        return { key: occurrence === 0 ? base : `${base}|${occurrence}`, state }
    })
}

function Snapshot({ snapshot, busy = false }: { snapshot: InteractiveGoalSnapshot; busy?: boolean }) {
    return (
        <div className="experimental-infoview__snapshot" aria-busy={busy || undefined}>
            {snapshot.states.length === 0 ? (
                <p className="experimental-infoview__empty">No tactic state at this position.</p>
            ) : (
                keyedStates(snapshot.states).map(({ key, state }) => <ProofStateCard key={key} state={state} />)
            )}
        </div>
    )
}

interface CachedSnapshot {
    uri: string
    documentRevision: number
    snapshot: InteractiveGoalSnapshot
}

function ExperimentalGoalSnapshot({ location }: { location: Location }) {
    const { documentRevision, result } = useGoalSnapshot(location)
    const cached = React.useRef<CachedSnapshot | undefined>(undefined)
    useSourceHighlight(location, result)

    React.useEffect(() => {
        if (result.state === 'resolved' && result.value) {
            cached.current = { uri: location.uri, documentRevision, snapshot: result.value }
        } else if (
            result.state !== 'loading' ||
            cached.current?.uri !== location.uri ||
            cached.current?.documentRevision !== documentRevision
        ) {
            cached.current = undefined
        }
    }, [documentRevision, location.uri, result])

    if (result.state === 'loading') {
        if (cached.current?.uri === location.uri && cached.current.documentRevision === documentRevision) {
            return (
                <EnvPosContext.Provider
                    value={{
                        uri: location.uri,
                        line: cached.current.snapshot.queryPosition.line,
                        character: cached.current.snapshot.queryPosition.character,
                    }}
                >
                    <Snapshot snapshot={cached.current.snapshot} busy />
                </EnvPosContext.Provider>
            )
        }
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
    return (
        <EnvPosContext.Provider
            value={{
                uri: location.uri,
                line: result.value.queryPosition.line,
                character: result.value.queryPosition.character,
            }}
        >
            <Snapshot snapshot={result.value} />
        </EnvPosContext.Provider>
    )
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
            <h1 id="experimental-infoview-title" className="experimental-infoview__visually-hidden">
                Experimental Infoview
            </h1>
            {content}
        </main>
    )
}
