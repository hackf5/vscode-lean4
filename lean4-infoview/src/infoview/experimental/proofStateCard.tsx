import {
    CodeWithInfos,
    InteractiveGoal,
    InteractiveGoalCore,
    InteractiveHypothesisBundle,
    InteractiveHypothesisBundle_nonAnonymousNames,
    InteractiveTermGoal,
} from '@leanprover/infoview-api'
import * as React from 'react'

import { InteractiveCode } from '../interactiveCode'
import type { InteractiveGoalState } from './rpc'

type ChangeKind = 'added' | 'removed' | 'changed'

function hasDiff(fmt: CodeWithInfos): boolean {
    if ('text' in fmt) return false
    if ('append' in fmt) return fmt.append.some(hasDiff)
    return fmt.tag[0].diffStatus !== undefined || hasDiff(fmt.tag[1])
}

function changeKind(
    value: { isInserted?: boolean; isRemoved?: boolean },
    expressions: (CodeWithInfos | undefined)[],
): ChangeKind | undefined {
    if (value.isInserted) return 'added'
    if (value.isRemoved) return 'removed'
    if (expressions.some(expression => expression !== undefined && hasDiff(expression))) return 'changed'
    return undefined
}

function ChangeMarker({ kind }: { kind: ChangeKind }) {
    const label = kind[0].toUpperCase() + kind.slice(1)
    return (
        <span className={`experimental-proof-card__change experimental-proof-card__change--${kind}`}>
            <span aria-hidden="true" />
            {label}
        </span>
    )
}

function HypothesisRow({ hypothesis }: { hypothesis: InteractiveHypothesisBundle }) {
    const names = InteractiveHypothesisBundle_nonAnonymousNames(hypothesis)
    const change = changeKind(hypothesis, [hypothesis.type, hypothesis.val])

    return (
        <div className="experimental-proof-card__hypothesis">
            <dt>
                <code>{names.length > 0 ? names.join(' ') : <span aria-label="anonymous assumption">_</span>}</code>
                {change && <ChangeMarker kind={change} />}
            </dt>
            <dd>
                <InteractiveCode fmt={hypothesis.type} />
                {hypothesis.val && (
                    <>
                        <span className="experimental-proof-card__definition" aria-label="defined as">
                            {' '}
                            :={' '}
                        </span>
                        <InteractiveCode fmt={hypothesis.val} />
                    </>
                )}
            </dd>
        </div>
    )
}

function goalKey(goal: InteractiveGoal, index: number): string {
    return goal.mvarId ?? `goal-${index}`
}

function hypothesisKey(hypothesis: InteractiveHypothesisBundle, index: number): string {
    return hypothesis.fvarIds && hypothesis.fvarIds.length > 0 ? hypothesis.fvarIds.join(':') : `hypothesis-${index}`
}

interface GoalContentProps {
    goal: InteractiveGoalCore
    goalPrefix?: string
    targetLabel: string
    targetChange?: ChangeKind
}

function GoalContent({ goal, goalPrefix = '⊢ ', targetLabel, targetChange }: GoalContentProps) {
    return (
        <>
            {goal.hyps.length > 0 && (
                <div className="experimental-proof-card__assumptions">
                    <h4 className="experimental-proof-card__visually-hidden">Assumptions</h4>
                    <dl>
                        {goal.hyps.map((hypothesis, hypothesisIndex) => (
                            <HypothesisRow key={hypothesisKey(hypothesis, hypothesisIndex)} hypothesis={hypothesis} />
                        ))}
                    </dl>
                </div>
            )}

            <div className="experimental-proof-card__target">
                <div className="experimental-proof-card__target-heading">
                    <span>{targetLabel}</span>
                    {targetChange && <ChangeMarker kind={targetChange} />}
                </div>
                <div className="experimental-proof-card__target-expression">
                    <span className="experimental-proof-card__turnstile" aria-hidden="true">
                        {goalPrefix}
                    </span>
                    <InteractiveCode fmt={goal.type} />
                </div>
            </div>
        </>
    )
}

function GoalSection({ goal, index, count }: { goal: InteractiveGoal; index: number; count: number }) {
    const headingId = React.useId()
    const goalChange = goal.isInserted ? 'added' : goal.isRemoved ? 'removed' : undefined
    const targetChange = goalChange ? undefined : changeKind({}, [goal.type])
    const hasVisibleHeading = count > 1 || goal.userName !== undefined || goalChange !== undefined
    const heading = count > 1 ? `Goal ${index + 1}` : 'Goal'

    return (
        <section className="experimental-proof-card__goal" aria-labelledby={headingId}>
            <div
                className={
                    hasVisibleHeading
                        ? 'experimental-proof-card__goal-heading'
                        : 'experimental-proof-card__goal-heading experimental-proof-card__visually-hidden'
                }
            >
                <h3 id={headingId}>{heading}</h3>
                {goal.userName && <code>case {goal.userName}</code>}
                {goalChange && <ChangeMarker kind={goalChange} />}
            </div>

            <GoalContent goal={goal} goalPrefix={goal.goalPrefix} targetLabel="Target" targetChange={targetChange} />
        </section>
    )
}

function goalCountLabel(count: number): string {
    if (count === 0) return 'No goals'
    if (count === 1) return '1 goal'
    return `${count} goals`
}

function tacticLabel(state: InteractiveGoalState): { display: string; exact?: string } {
    const exact = state.tacticText
    if (!exact) return { display: 'selected tactic' }
    return { display: exact.replace(/\s+/g, ' ').trim() || 'selected tactic', exact }
}

export function ProofStateCard({ state }: { state: InteractiveGoalState }) {
    const headingId = React.useId()
    const tactic = tacticLabel(state)
    const goals = state.goals.goals

    return (
        <article className="experimental-proof-card" aria-labelledby={headingId}>
            <header className="experimental-proof-card__header">
                <div className="experimental-proof-card__identity">
                    <h2 id={headingId}>
                        {state.declaration ? <code>{state.declaration.name}</code> : 'Current command'}
                    </h2>
                    <p>
                        <span>{state.useAfter ? 'After' : 'Before'}</span>
                        <code title={tactic.exact} aria-label={tactic.exact}>
                            {tactic.display}
                        </code>
                    </p>
                </div>
                <span className="experimental-proof-card__count">{goalCountLabel(goals.length)}</span>
            </header>

            <div className="experimental-proof-card__body">
                {goals.length === 0 ? (
                    <p className="experimental-proof-card__complete">No goals remain.</p>
                ) : (
                    goals.map((goal, index) => (
                        <GoalSection key={goalKey(goal, index)} goal={goal} index={index} count={goals.length} />
                    ))
                )}
            </div>
        </article>
    )
}

export function ExpectedTypeCard({ expectedType }: { expectedType: InteractiveTermGoal }) {
    const headingId = React.useId()
    const contextHeadingId = React.useId()

    return (
        <article className="experimental-proof-card experimental-expected-type-card" aria-labelledby={headingId}>
            <header className="experimental-proof-card__header">
                <div className="experimental-proof-card__identity">
                    <h2 id={headingId}>Expected type</h2>
                </div>
            </header>
            <div className="experimental-proof-card__body">
                <section className="experimental-proof-card__goal" aria-labelledby={contextHeadingId}>
                    <h3 id={contextHeadingId} className="experimental-proof-card__visually-hidden">
                        Expected type context
                    </h3>
                    <GoalContent goal={expectedType} targetLabel="Type" />
                </section>
            </div>
        </article>
    )
}
