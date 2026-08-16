import {
    CodeWithInfos,
    InteractiveGoal,
    InteractiveHypothesisBundle,
    InteractiveHypothesisBundle_nonAnonymousNames,
    InteractiveTermGoal,
} from '@leanprover/infoview-api'
import * as React from 'react'

import { InteractiveCode } from '../interactiveCode'
import type { DeclarationScope, InteractiveGoalState } from './rpc'

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

function DiffMarker({ kind }: { kind?: ChangeKind }) {
    if (kind !== 'added' && kind !== 'removed') return null

    const label = kind === 'added' ? 'Added' : 'Removed'
    const symbol = kind === 'added' ? '+' : '−'
    return (
        <span className={`experimental-proof-card__diff-marker experimental-proof-card__diff-marker--${kind}`}>
            <span aria-hidden="true">{symbol}</span>
            <span className="experimental-proof-card__visually-hidden">{label}: </span>
        </span>
    )
}

function changedNameClass(kind: ChangeKind | undefined): string | undefined {
    return kind === 'added' || kind === 'removed' ? `experimental-proof-card__name--${kind}` : undefined
}

function HypothesisMarker({ change, instance }: { change?: ChangeKind; instance?: string }) {
    const hasDiffMarker = change === 'added' || change === 'removed'
    return (
        <span className="experimental-proof-card__row-marker">
            <DiffMarker kind={change} />
            {instance !== undefined ? (
                <span className="experimental-proof-card__instance-marker" aria-hidden="true">
                    {instance}
                </span>
            ) : (
                !hasDiffMarker && (
                    <span
                        className="experimental-proof-card__instance-marker experimental-proof-card__instance-marker--placeholder"
                        aria-hidden="true"
                    >
                        []
                    </span>
                )
            )}
        </span>
    )
}

function hypothesisKey(hypothesis: InteractiveHypothesisBundle, index: number): string {
    return hypothesis.fvarIds && hypothesis.fvarIds.length > 0 ? hypothesis.fvarIds.join(':') : `hypothesis-${index}`
}

function isInaccessibleName(name: string): boolean {
    return name.includes('✝')
}

function inaccessibleBaseName(name: string): string {
    const daggerIndex = name.indexOf('✝')
    return daggerIndex < 0 ? name : name.slice(0, daggerIndex)
}

const superscriptDigits: Record<string, string> = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
}

function inaccessibleNameIndex(name: string): string | undefined {
    const daggerIndex = name.indexOf('✝')
    if (daggerIndex < 0) return undefined

    const suffix = name.slice(daggerIndex + 1)
    if (suffix.length === 0) return '0'

    let index = ''
    for (const digit of suffix) {
        const ordinaryDigit = superscriptDigits[digit]
        if (ordinaryDigit === undefined) return undefined
        index += ordinaryDigit
    }
    return index
}

function shadowedHypothesisNames(contexts: InteractiveHypothesisBundle[][]): ReadonlySet<string> {
    const shadowed = new Set<string>()
    for (const context of contexts) {
        const names = context.flatMap(InteractiveHypothesisBundle_nonAnonymousNames)
        const accessibleNames = new Set(names.filter(name => !isInaccessibleName(name)))
        for (const name of names) {
            if (isInaccessibleName(name) && accessibleNames.has(inaccessibleBaseName(name))) shadowed.add(name)
        }
    }
    return shadowed
}

interface HypothesisNameParts {
    visible: string[]
    hidden: string[]
    anonymousCount: number
}

function hypothesisNameParts(hypothesis: InteractiveHypothesisBundle): HypothesisNameParts {
    const nonAnonymous = InteractiveHypothesisBundle_nonAnonymousNames(hypothesis)
    if (!hypothesis.isInstance) {
        return {
            visible: nonAnonymous,
            hidden: [],
            anonymousCount: hypothesis.names.length - nonAnonymous.length,
        }
    }
    return {
        visible: nonAnonymous.filter(name => !isInaccessibleName(name)),
        hidden: nonAnonymous.filter(isInaccessibleName),
        anonymousCount: hypothesis.names.length - nonAnonymous.length,
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

function OrdinaryHypothesisRow({
    hypothesis,
    names,
    shadowedNames,
}: {
    hypothesis: InteractiveHypothesisBundle
    names: string[]
    shadowedNames: ReadonlySet<string>
}) {
    const change = changeKind(hypothesis, [hypothesis.type, hypothesis.val])

    return (
        <div className="experimental-proof-card__hypothesis">
            <dt>
                <HypothesisMarker change={change} />
                <span className="experimental-proof-card__hypothesis-name">
                    <code className={changedNameClass(change)}>
                        {names.length > 0 ? (
                            names.map((name, index) => (
                                <React.Fragment key={`${name}|${index}`}>
                                    {index > 0 && ' '}
                                    {shadowedNames.has(name) ? (
                                        <>
                                            <s className="experimental-proof-card__shadowed-name" aria-hidden="true">
                                                {inaccessibleBaseName(name)}
                                            </s>
                                            <span className="experimental-proof-card__visually-hidden">
                                                {inaccessibleBaseName(name)}, shadowed
                                            </span>
                                        </>
                                    ) : (
                                        name
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <span aria-label="anonymous assumption">_</span>
                        )}
                    </code>
                </span>
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
    anonymousIndex,
}: {
    hypothesis: InteractiveHypothesisBundle
    names: string[]
    anonymous: boolean
    anonymousIndex?: string
}) {
    const change = changeKind(hypothesis, [hypothesis.type, hypothesis.val])
    const marker = anonymousIndex === undefined ? '[]' : `[${anonymousIndex}]`

    return (
        <div
            className={`experimental-proof-card__hypothesis experimental-proof-card__instance-binder${
                anonymous ? ' experimental-proof-card__instance-binder--anonymous' : ''
            }`}
        >
            <dt>
                <HypothesisMarker change={change} instance={marker} />
                <span className="experimental-proof-card__hypothesis-name">
                    <span className="experimental-proof-card__visually-hidden">
                        {anonymous
                            ? `Anonymous instance parameter${
                                  anonymousIndex === undefined ? '' : `, Lean index ${anonymousIndex}`
                              }`
                            : 'Instance parameter '}
                    </span>
                    {!anonymous && <code className={changedNameClass(change)}>{names.join(' ')}</code>}
                </span>
            </dt>
            <dd>
                <HypothesisExpression hypothesis={hypothesis} />
            </dd>
        </div>
    )
}

function HypothesisRows({
    hypothesis,
    shadowedNames,
}: {
    hypothesis: InteractiveHypothesisBundle
    shadowedNames: ReadonlySet<string>
}) {
    const names = hypothesisNameParts(hypothesis)
    if (!hypothesis.isInstance)
        return <OrdinaryHypothesisRow hypothesis={hypothesis} names={names.visible} shadowedNames={shadowedNames} />

    const unindexedCount = Math.max(
        names.anonymousCount,
        names.visible.length === 0 && names.hidden.length === 0 ? 1 : 0,
    )
    return (
        <>
            {names.visible.length > 0 && (
                <InstanceHypothesisRow hypothesis={hypothesis} names={names.visible} anonymous={false} />
            )}
            {names.hidden.map((name, index) => (
                <InstanceHypothesisRow
                    key={`${name}|${index}`}
                    hypothesis={hypothesis}
                    names={[]}
                    anonymous
                    anonymousIndex={inaccessibleNameIndex(name)}
                />
            ))}
            {Array.from({ length: unindexedCount }, (_, index) => (
                <InstanceHypothesisRow key={`anonymous|${index}`} hypothesis={hypothesis} names={[]} anonymous />
            ))}
        </>
    )
}

function Context({
    hypotheses,
    nameScopes = [hypotheses],
}: {
    hypotheses: InteractiveHypothesisBundle[]
    nameScopes?: InteractiveHypothesisBundle[][]
}) {
    if (hypotheses.length === 0) return null
    const shadowedNames = shadowedHypothesisNames(nameScopes)

    return (
        <div className="experimental-proof-card__context">
            <div className="experimental-proof-card__assumptions">
                <dl>
                    {hypotheses.map((hypothesis, index) => (
                        <React.Fragment key={hypothesisKey(hypothesis, index)}>
                            <HypothesisRows hypothesis={hypothesis} shadowedNames={shadowedNames} />
                        </React.Fragment>
                    ))}
                </dl>
            </div>
        </div>
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
    return `${count} goals`
}

function tacticLabel(state: InteractiveGoalState): { display: string; exact?: string } {
    const exact = state.tacticText
    if (!exact) return { display: 'Selected tactic' }
    return { display: exact.replace(/\s+/g, ' ').trim() || 'Selected tactic', exact }
}

function TargetExpression({
    label,
    prefix,
    type,
    change,
}: {
    label?: string
    prefix: string
    type: CodeWithInfos
    change?: ChangeKind
}) {
    const stateLabel = change === 'added' ? 'Added target' : change === 'removed' ? 'Removed target' : label
    const turnstileClass = `experimental-proof-card__turnstile${
        change === 'added' || change === 'removed' ? ` experimental-proof-card__turnstile--${change}` : ''
    }`

    return (
        <div className="experimental-proof-card__target-expression">
            {stateLabel && <span className="experimental-proof-card__visually-hidden">{stateLabel}: </span>}
            <span className={turnstileClass} aria-hidden="true">
                {prefix}
            </span>
            <InteractiveCode fmt={type} />
        </div>
    )
}

function Target({ goal, change }: { goal: InteractiveGoal; change?: ChangeKind }) {
    return (
        <div className="experimental-proof-card__target">
            <TargetExpression label="Target" prefix={goal.goalPrefix ?? '⊢ '} type={goal.type} change={change} />
        </div>
    )
}

function ExpectedType({ expectedType, sharedCount }: { expectedType: InteractiveTermGoal; sharedCount: number }) {
    const headingId = React.useId()

    return (
        <section className="experimental-proof-card__phase" aria-labelledby={headingId}>
            <h3 id={headingId} className="experimental-proof-card__visually-hidden">
                Expected type
            </h3>
            <Context hypotheses={expectedType.hyps.slice(sharedCount)} nameScopes={[expectedType.hyps]} />
            <TargetExpression prefix="⊢ " type={expectedType.type} />
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
    const hasVisibleHeading = count > 1 || goal.userName !== undefined

    return (
        <section className="experimental-proof-card__goal" aria-labelledby={headingId}>
            <div
                className={
                    hasVisibleHeading
                        ? 'experimental-proof-card__goal-heading'
                        : 'experimental-proof-card__goal-heading experimental-proof-card__visually-hidden'
                }
            >
                <h4 id={headingId} className={changedNameClass(goalChange)}>
                    {count > 1 ? `Goal ${index + 1}` : 'Goal'}
                </h4>
                {goal.userName && <code className={changedNameClass(goalChange)}>case {goal.userName}</code>}
            </div>
            <Context hypotheses={goal.hyps.slice(sharedCount)} nameScopes={[goal.hyps]} />
            <Target goal={goal} change={goalChange ?? targetChange} />
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

function Outcome({
    state,
    count,
    sharedCount,
    showDivider,
}: {
    state: InteractiveGoalState
    count: number
    sharedCount: number
    showDivider: boolean
}) {
    const headingId = React.useId()
    const tactic = tacticLabel(state)
    const goals = state.goals.goals
    const phase = state.useAfter ? 'After' : 'Before'

    return (
        <section
            className="experimental-proof-card__phase experimental-proof-card__outcome"
            aria-labelledby={headingId}
        >
            <h3 id={headingId} className="experimental-proof-card__visually-hidden">
                {phase}: {tactic.exact ?? tactic.display}
            </h3>
            {showDivider && (
                <div
                    className={`experimental-proof-card__outcome-divider${
                        count > 1 ? ' experimental-proof-card__outcome-divider--captioned' : ''
                    }`}
                    aria-hidden="true"
                >
                    {count > 1 && <code title={tactic.exact}>{tactic.display}</code>}
                </div>
            )}
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

function cardTitle(states: InteractiveGoalState[], snapshotDeclaration?: DeclarationScope): React.ReactNode {
    const stateDeclaration = states[0]?.declaration?.name
    const declaration =
        stateDeclaration && states.every(state => state.declaration?.name === stateDeclaration)
            ? stateDeclaration
            : snapshotDeclaration?.name
    if (!declaration) return states.length === 0 ? 'Current expression' : 'Current command'

    const separator = declaration.lastIndexOf('.') + 1
    return (
        <code>
            {separator > 0 && (
                <span className="experimental-proof-card__declaration-prefix">{declaration.slice(0, separator)}</span>
            )}
            {declaration.slice(separator)}
        </code>
    )
}

export function ProofSnapshotCard({
    states,
    expectedType,
    declaration,
}: {
    states: InteractiveGoalState[]
    expectedType?: InteractiveTermGoal
    declaration?: DeclarationScope
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

    return (
        <article className="experimental-proof-card" aria-labelledby={headingId}>
            <header className="experimental-proof-card__header">
                <div className="experimental-proof-card__identity">
                    <h2 id={headingId}>{cardTitle(states, declaration)}</h2>
                    {singleTactic && (
                        <p>
                            <code title={singleTactic.exact} aria-label={singleTactic.exact}>
                                {singleTactic.display}
                            </code>
                        </p>
                    )}
                </div>
                {states.length === 1 && goalCount > 1 && (
                    <span className="experimental-proof-card__count">{goalCountLabel(goalCount)}</span>
                )}
                {states.length > 1 && <span className="experimental-proof-card__count">{states.length} outcomes</span>}
            </header>

            <div className="experimental-proof-card__body">
                {sharedContext.length > 0 && (
                    <section className="experimental-proof-card__shared-context">
                        <h3 className="experimental-proof-card__visually-hidden">Shared context</h3>
                        <Context hypotheses={sharedContext} nameScopes={contexts} />
                    </section>
                )}
                {expectedType && <ExpectedType expectedType={expectedType} sharedCount={sharedCount} />}
                {states.map((state, index) => (
                    <Outcome
                        key={stateKey(state, index)}
                        state={state}
                        count={states.length}
                        sharedCount={sharedCount}
                        showDivider={expectedType !== undefined || index > 0 || states.length > 1}
                    />
                ))}
            </div>
        </article>
    )
}
