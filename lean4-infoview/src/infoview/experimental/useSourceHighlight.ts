import type { ExperimentalInfoviewSourceHighlight } from '@leanprover/infoview-api'
import * as React from 'react'
import type { Location, Range } from 'vscode-languageserver-protocol'

import { EditorContext } from '../contexts'
import type { AsyncState } from '../util'
import type { InteractiveGoalSnapshot } from './rpc'
import type { InteractivePositionSnapshot } from './usePositionSnapshot'

function rangeKey(range: Range): string {
    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`
}

function uniqueRanges(ranges: Iterable<Range | undefined>): Range[] {
    const result = new Map<string, Range>()
    for (const range of ranges) {
        if (range) result.set(rangeKey(range), range)
    }
    return [...result.values()]
}

function sourceHighlight(
    uri: string,
    snapshot: InteractiveGoalSnapshot,
): ExperimentalInfoviewSourceHighlight | undefined {
    const declarationRanges = uniqueRanges(snapshot.states.map(state => state.declaration?.range))
    const scopeRanges = declarationRanges.length > 0 ? declarationRanges : uniqueRanges([snapshot.commandRange])
    const tacticRanges = uniqueRanges(snapshot.states.map(state => state.tacticRange))
    if (scopeRanges.length === 0 && tacticRanges.length === 0) return undefined
    return { uri, scopeRanges, tacticRanges }
}

export function useSourceHighlight(location: Location, result: AsyncState<InteractivePositionSnapshot>): void {
    const editor = React.useContext(EditorContext)
    const previousUri = React.useRef<string | undefined>(undefined)

    const updateHighlight = React.useCallback(
        (highlight: ExperimentalInfoviewSourceHighlight | undefined) => {
            const request = editor.api.setExperimentalInfoviewSourceHighlight?.(highlight)
            void request?.catch(error => {
                console.error('Unable to update the experimental Infoview source highlight.', error)
            })
        },
        [editor],
    )

    React.useEffect(() => {
        if (previousUri.current !== undefined && previousUri.current !== location.uri) {
            updateHighlight(undefined)
        }
        previousUri.current = location.uri
    }, [location.uri, updateHighlight])

    React.useEffect(() => {
        if (result.state === 'loading') return
        const highlight =
            result.state === 'resolved' && result.value.scopedGoals
                ? sourceHighlight(location.uri, result.value.scopedGoals)
                : undefined
        updateHighlight(highlight)
    }, [location.uri, result, updateHighlight])

    React.useEffect(
        () => () => {
            updateHighlight(undefined)
        },
        [updateHighlight],
    )
}
