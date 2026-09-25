---
status: accepted
date: 2026-09-25
decision-makers: André Hofer
---

# Record decisions in MADR and keep specs and plans out of the repo

## Context and problem statement

Every feature so far was designed with the Superpowers `brainstorming` and `writing-plans` skills,
and both committed their output. By September 2026, `docs/superpowers/` held 26 specs and 26 plans.

Those files are written for one task. They mix lasting decisions with task steps, test lists and
file-by-file instructions. Several no longer match the code: the marker popup spec describes an
approach that was reverted in the same pull request, and the poster spec lists two non-goals that
have since shipped. Nobody reading the code can tell which parts of a spec still hold, and source
comments linked to specs as if they were documentation.

Where should decisions live so that they stay findable and true?

## Considered options

* Keep committing specs and plans, and treat them as the record
* Keep specs and plans out of the repo, and write lasting decisions as ADRs in MADR format
* Keep specs and plans out of the repo, and record nothing beyond code comments

## Decision outcome

Chosen option: specs and plans stay out of the repo, and lasting decisions go into ADRs in
`docs/adr/` using [MADR](https://adr.github.io/madr/). An ADR holds one decision, the options that
were turned down, and why. That's the part that still matters months later, and it's short enough to
keep accurate.

Specs and plans are still written while working, in `docs/superpowers/` (which is gitignored) or in
the session's scratch space. CLAUDE.md tells agents to do that instead of committing them.

### Consequences

* Good, because a reader finds decisions in one place, each with its reasons and rejected options.
* Good, because a superseded decision gets a new record and a status change, so old reasoning stays
  readable without pretending to be current.
* Bad, because someone has to notice when a task produced a decision worth recording. The specs
  captured everything by default.
* Bad, because the history of how a feature was designed step by step is no longer in the repo. It
  survives in pull request descriptions and in git history up to the commit that removed
  `docs/superpowers/`.

### Confirmation

`docs/superpowers/` is in `.gitignore`. Review checks that a pull request which changes an
architectural choice either adds an ADR or supersedes one.

## More information

The decisions still valid from the removed specs were rewritten as ADRs 0001 to 0012, each dated to
when it was first made. Issue: [#74](https://github.com/hoferan/schwingkeller/issues/74).
