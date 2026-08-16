import {
    CodeWithInfos,
    InteractiveGoal,
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

function hypothesisKey(hypothesis: InteractiveHypothesisBundle, index: number): string {
    return hypothesis.fvarIds && hypothesis.fvarIds.length > 0 ? hypothesis.fvarIds.join(':') : `hypothesis-${index}`
}

function isInaccessibleName(name: string): boolean {
    return name.includes('✝')
}

interface HypothesisNameParts {
    accessible: string[]
    inaccessible: string[]
    hasAnonymous: boolean
}

function hypothesisNameParts(hypothesis: InteractiveHypothesisBundle): HypothesisNameParts {
    const nonAnonymous = InteractiveHypothesisBundle_nonAnonymousNames(hypothesis)
    if (!hypothesis.isInstance) {
        return {
            accessible: nonAnonymous,
            inaccessible: [],
            hasAnonymous: nonAnonymous.length < hypothesis.names.length,
        }
    }
    return {
        accessible: nonAnonymous.filter(name => !isInaccessibleName(name)),
        inaccessible: nonAnonymous.filter(isInaccessibleName),
        hasAnonymous: nonAnonymous.length < hypothesis.names.length,
    }
}

function HypothesisExpression({ hypothesis }: { hypothesis: InteractiveHypothesisBundle }) {
    return (
        <>
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
        </>
    )
}

function OrdinaryHypothesisRow({ hypothesis, names }: { hypothesis: InteractiveHypothesisBundle; names: string[] }) {
    const change = changeKind(hypothesis, [hypothesis.type, hypothesis.val])

    return (
        <div className="experimental-proof-card__hypothesis">
            <dt>
                <code>{names.length > 0 ? names.join(' ') : <span aria-label="anonymous assumption">_</span>}</code>
                {change && <ChangeMarker kind={change} />}
            </dt>
            <dd>
                <HypothesisExpression hypothesis={hypothesis} />
            </dd>
        </div>
    )
}

function InstanceHypothesisRow({
    hypothesis,
    names,
    anonymous,
}: {
    hypothesis: InteractiveHypothesisBundle
    names: string[]
    anonymous: boolean
}) {
    const change = changeKind(hypothesis, [hypothesis.type, hypothesis.val])
    const description = anonymous ? 'Anonymous instance parameter' : `Instance parameter ${names.join(' ')}`

    return (
        <div
            className={`experimental-proof-card__hypothesis experimental-proof-card__instance-binder${
                anonymous ? ' experimental-proof-card__instance-binder--anonymous' : ''
            }`}
        >
            <dt className="experimental-proof-card__visually-hidden">{description}</dt>
            <dd>
                <span className="experimental-proof-card__binder-bracket" aria-hidden="true">
                    [
                </span>
                {!anonymous && (
                    <>
                        <code className="experimental-proof-card__binder-name" aria-hidden="true">
                            {names.join(' ')}
                        </code>
                        <span className="experimental-proof-card__binder-separator" aria-hidden="true">
                            {' '}
                            :{' '}
                        </span>
                    </>
                )}
                <span className="experimental-proof-card__binder-type">
                    <HypothesisExpression hypothesis={hypothesis} />
                </span>
                <span className="experimental-proof-card__binder-bracket" aria-hidden="true">
                    ]
                </span>
                {change && <ChangeMarker kind={change} />}
            </dd>
        </div>
    )
}

function HypothesisRows({ hypothesis }: { hypothesis: InteractiveHypothesisBundle }) {
    const names = hypothesisNameParts(hypothesis)
    if (!hypothesis.isInstance) return <OrdinaryHypothesisRow hypothesis={hypothesis} names={names.accessible} />

    const hasAnonymousPart = names.inaccessible.length > 0 || names.hasAnonymous || names.accessible.length === 0
    return (
        <>
            {names.accessible.length > 0 && (
                <InstanceHypothesisRow hypothesis={hypothesis} names={names.accessible} anonymous={false} />
            )}
            {hasAnonymousPart && <InstanceHypothesisRow hypothesis={hypothesis} names={[]} anonymous />}
        </>
    )
}

function Context({ hypotheses }: { hypotheses: InteractiveHypothesisBundle[] }) {
    if (hypotheses.length === 0) return null

    return (
        <div className="experimental-proof-card__context">
            <div className="experimental-proof-card__assumptions">
                <dl>
                    {hypotheses.map((hypothesis, index) => (
                        <React.Fragment key={hypothesisKey(hypothesis, index)}>
                            <HypothesisRows hypothesis={hypothesis} />
                        </React.Fragment>
                    ))}
                </dl>
            </div>
        </div>
    )
}

interface TechnicalScope {
    key: string
    label: string
    hypotheses: InteractiveHypothesisBundle[]
}

interface GeneratedInstanceName {
    key: string
    name: string
    hypothesis: InteractiveHypothesisBundle
}

function generatedInstanceNames(hypotheses: InteractiveHypothesisBundle[]): GeneratedInstanceName[] {
    return hypotheses.flatMap((hypothesis, hypothesisIndex) => {
        if (!hypothesis.isInstance) return []
        return hypothesisNameParts(hypothesis).inaccessible.map((name, nameIndex) => ({
            key: `${hypothesisKey(hypothesis, hypothesisIndex)}|${nameIndex}`,
            name,
            hypothesis,
        }))
    })
}

function TechnicalScopeSection({ label, entries }: { label: string; entries: GeneratedInstanceName[] }) {
    const headingId = React.useId()
    return (
        <section className="experimental-proof-card__technical-scope" aria-labelledby={headingId}>
            <h3 id={headingId}>{label}</h3>
            <dl>
                {entries.map(entry => (
                    <div key={entry.key}>
                        <dt>
                            <code>{entry.name}</code>
                        </dt>
                        <dd>
                            <HypothesisExpression hypothesis={entry.hypothesis} />
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    )
}

function TechnicalDetails({ scopes }: { scopes: TechnicalScope[] }) {
    const populatedScopes = scopes
        .map(scope => ({ ...scope, entries: generatedInstanceNames(scope.hypotheses) }))
        .filter(scope => scope.entries.length > 0)
    if (populatedScopes.length === 0) return null

    return (
        <details className="experimental-proof-card__technical-details">
            <summary>Technical details</summary>
            <div className="experimental-proof-card__technical-details-body">
                {populatedScopes.map(scope => (
                    <TechnicalScopeSection key={scope.key} label={scope.label} entries={scope.entries} />
                ))}
            </div>
        </details>
    )
}

function sameHypothesisIdentity(left: InteractiveHypothesisBundle, right: InteractiveHypothesisBundle): boolean {
    if (!left.fvarIds || left.fvarIds.length === 0 || !right.fvarIds || right.fvarIds.length === 0) return false
    return (
        left.fvarIds.length === right.fvarIds.length && left.fvarIds.every((id, index) => id === right.fvarIds![index])
    )
}

function sharedContextLength(contexts: InteractiveHypothesisBundle[][]): number {
    if (contexts.length === 0) return 0
    if (contexts.length === 1) return contexts[0].length

    const first = contexts[0]
    let length = 0
    while (
        length < first.length &&
        contexts
            .slice(1)
            .every(context =>
                context.length > length ? sameHypothesisIdentity(first[length], context[length]) : false,
            )
    ) {
        length += 1
    }
    return length
}

function goalKey(goal: InteractiveGoal, index: number): string {
    return goal.mvarId ?? `goal-${index}`
}

function goalCountLabel(count: number): string {
    if (count === 0) return 'No goals'
    if (count === 1) return '1 goal'
    return `${count} goals`
}

function tacticLabel(state: InteractiveGoalState): { display: string; exact?: string } {
    const exact = state.tacticText
    if (!exact) return { display: 'Selected tactic' }
    return { display: exact.replace(/\s+/g, ' ').trim() || 'Selected tactic', exact }
}

function Target({ goal, change }: { goal: InteractiveGoal; change?: ChangeKind }) {
    return (
        <div className="experimental-proof-card__target">
            <div className="experimental-proof-card__target-heading">
                <span>Target</span>
                {change && <ChangeMarker kind={change} />}
            </div>
            <div className="experimental-proof-card__target-expression">
                <span className="experimental-proof-card__turnstile" aria-hidden="true">
                    {goal.goalPrefix}
                </span>
                <InteractiveCode fmt={goal.type} />
            </div>
        </div>
    )
}

function ExpectedType({ expectedType, sharedCount }: { expectedType: InteractiveTermGoal; sharedCount: number }) {
    const headingId = React.useId()

    return (
        <section className="experimental-proof-card__phase" aria-labelledby={headingId}>
            <h3 id={headingId} className="experimental-proof-card__phase-heading">
                Expected type
            </h3>
            <Context hypotheses={expectedType.hyps.slice(sharedCount)} />
            <div className="experimental-proof-card__expected-expression">
                <span className="experimental-proof-card__turnstile" aria-hidden="true">
                    ⊢{' '}
                </span>
                <InteractiveCode fmt={expectedType.type} />
            </div>
        </section>
    )
}

function Goal({
    goal,
    index,
    count,
    sharedCount,
}: {
    goal: InteractiveGoal
    index: number
    count: number
    sharedCount: number
}) {
    const headingId = React.useId()
    const goalChange = goal.isInserted ? 'added' : goal.isRemoved ? 'removed' : undefined
    const targetChange = goalChange ? undefined : changeKind({}, [goal.type])
    const hasVisibleHeading = count > 1 || goal.userName !== undefined || goalChange !== undefined

    return (
        <section className="experimental-proof-card__goal" aria-labelledby={headingId}>
            <div
                className={
                    hasVisibleHeading
                        ? 'experimental-proof-card__goal-heading'
                        : 'experimental-proof-card__goal-heading experimental-proof-card__visually-hidden'
                }
            >
                <h4 id={headingId}>{count > 1 ? `Goal ${index + 1}` : 'Goal'}</h4>
                {goal.userName && <code>case {goal.userName}</code>}
                {goalChange && <ChangeMarker kind={goalChange} />}
            </div>
            <Context hypotheses={goal.hyps.slice(sharedCount)} />
            <Target goal={goal} change={targetChange} />
        </section>
    )
}

function stateKey(state: InteractiveGoalState, index: number): string {
    const range = state.tacticRange
    const rangePart = range
        ? `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`
        : 'no-range'
    return `${rangePart}|${state.useAfter ? 'after' : 'before'}|${state.declaration?.name ?? 'command'}|${index}`
}

function Outcome({ state, count, sharedCount }: { state: InteractiveGoalState; count: number; sharedCount: number }) {
    const headingId = React.useId()
    const tactic = tacticLabel(state)
    const goals = state.goals.goals

    return (
        <section
            className="experimental-proof-card__phase experimental-proof-card__outcome"
            aria-labelledby={headingId}
        >
            <div className="experimental-proof-card__phase-heading">
                <h3 id={headingId}>{state.useAfter ? 'After' : 'Before'}</h3>
                {count > 1 && (
                    <code title={tactic.exact} aria-label={tactic.exact}>
                        {tactic.display}
                    </code>
                )}
            </div>
            {goals.length === 0 ? (
                <p className="experimental-proof-card__complete">No goals remain.</p>
            ) : (
                goals.map((goal, goalIndex) => (
                    <Goal
                        key={goalKey(goal, goalIndex)}
                        goal={goal}
                        index={goalIndex}
                        count={goals.length}
                        sharedCount={sharedCount}
                    />
                ))
            )}
        </section>
    )
}

function cardTitle(states: InteractiveGoalState[]): React.ReactNode {
    if (states.length === 0) return 'Current expression'
    const declaration = states[0].declaration?.name
    return declaration && states.every(state => state.declaration?.name === declaration) ? (
        <code>{declaration}</code>
    ) : (
        'Current command'
    )
}

function outcomeScopeLabel(
    state: InteractiveGoalState,
    stateIndex: number,
    stateCount: number,
    goal: InteractiveGoal,
    goalIndex: number,
    goalCount: number,
): string {
    const parts = [state.useAfter ? 'After' : 'Before']
    if (stateCount > 1) parts.push(`outcome ${stateIndex + 1}`)
    if (goalCount > 1) parts.push(`goal ${goalIndex + 1}`)
    if (goal.userName) parts.push(`case ${goal.userName}`)
    return parts.join(' · ')
}

export function ProofSnapshotCard({
    states,
    expectedType,
}: {
    states: InteractiveGoalState[]
    expectedType?: InteractiveTermGoal
}) {
    const headingId = React.useId()
    const goalCount = states.reduce((total, state) => total + state.goals.goals.length, 0)
    const contexts = [
        ...(expectedType ? [expectedType.hyps] : []),
        ...states.flatMap(state => state.goals.goals.map(goal => goal.hyps)),
    ]
    const sharedCount = sharedContextLength(contexts)
    const sharedContext = contexts.length > 0 ? contexts[contexts.length - 1].slice(0, sharedCount) : []
    const singleTactic = states.length === 1 ? tacticLabel(states[0]) : undefined
    const technicalScopes: TechnicalScope[] = [
        { key: 'shared', label: 'Shared context', hypotheses: sharedContext },
        ...(expectedType
            ? [
                  {
                      key: 'expected',
                      label: 'Expected type',
                      hypotheses: expectedType.hyps.slice(sharedCount),
                  },
              ]
            : []),
        ...states.flatMap((state, stateIndex) =>
            state.goals.goals.map((goal, goalIndex) => ({
                key: `${stateKey(state, stateIndex)}|${goalKey(goal, goalIndex)}`,
                label: outcomeScopeLabel(state, stateIndex, states.length, goal, goalIndex, state.goals.goals.length),
                hypotheses: goal.hyps.slice(sharedCount),
            })),
        ),
    ]

    return (
        <article className="experimental-proof-card" aria-labelledby={headingId}>
            <header className="experimental-proof-card__header">
                <div className="experimental-proof-card__identity">
                    <h2 id={headingId}>{cardTitle(states)}</h2>
                    {singleTactic && (
                        <p>
                            <code title={singleTactic.exact} aria-label={singleTactic.exact}>
                                {singleTactic.display}
                            </code>
                        </p>
                    )}
                </div>
                {states.length === 1 && (
                    <span className="experimental-proof-card__count">{goalCountLabel(goalCount)}</span>
                )}
                {states.length > 1 && <span className="experimental-proof-card__count">{states.length} outcomes</span>}
            </header>

            <div className="experimental-proof-card__body">
                {sharedContext.length > 0 && (
                    <section className="experimental-proof-card__shared-context">
                        <h3 className="experimental-proof-card__visually-hidden">Shared context</h3>
                        <Context hypotheses={sharedContext} />
                    </section>
                )}
                {expectedType && <ExpectedType expectedType={expectedType} sharedCount={sharedCount} />}
                {states.map((state, index) => (
                    <Outcome
                        key={stateKey(state, index)}
                        state={state}
                        count={states.length}
                        sharedCount={sharedCount}
                    />
                ))}
                <TechnicalDetails scopes={technicalScopes} />
            </div>
        </article>
    )
}
