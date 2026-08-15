import type { ClientRequestOptions, InteractiveGoals, RpcSessionAtPos } from '@leanprover/infoview-api'
import type { Position, Range, TextDocumentPositionParams } from 'vscode-languageserver-protocol'

export const interactiveGoalSnapshotMethod = 'Picard.ExperimentalInfoview.getInteractiveGoalSnapshot'

export interface DeclarationScope {
    name: string
    range?: Range
    selectionRange?: Range
}

export interface InteractiveGoalState {
    tacticRange?: Range
    tacticText?: string
    useAfter: boolean
    declaration?: DeclarationScope
    goals: InteractiveGoals
}

export interface InteractiveGoalSnapshot {
    queryPosition: Position
    commandRange?: Range
    states: InteractiveGoalState[]
}

export function getInteractiveGoalSnapshot(
    session: RpcSessionAtPos,
    position: TextDocumentPositionParams,
    options?: ClientRequestOptions,
): Promise<InteractiveGoalSnapshot> {
    return session.call(interactiveGoalSnapshotMethod, position, options)
}
