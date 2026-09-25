# Architecture decision records

This folder holds the decisions that shape the code and would surprise someone reading it for the
first time: why something is built the way it is, and which alternatives were turned down. Each
record uses the [MADR](https://adr.github.io/madr/) format.

Design specs and implementation plans written while working on a task are not kept here, and are
not committed at all (see [ADR 0000](0000-use-madr-for-decisions.md)). When one of them settles
something that should outlast the task, write it up as an ADR.

## Adding a record

1. Copy [`adr-template.md`](adr-template.md) to `NNNN-short-title.md`, using the next free number.
2. Fill in the context, the options you considered, and the one you chose. Leave out sections that
   have nothing to say.
3. Set `status` to `accepted` when the work behind the decision is done. For work that runs over
   several issues, such as a milestone, the record can be merged as `proposed` with the first issue
   that settles something. Later issues in that work extend it, and the last one sets it to
   `accepted`.
4. Add it to the index below.

An accepted record isn't edited to describe a new decision. When a decision changes, write a new
record, set the old one's status to `superseded by [NNNN](NNNN-....md)`, and link back to it from
the new one.

## When a record is done

A record is ready for `accepted` when the decision meets the
[ecADR definition of done](https://www.ozimmer.ch/practices/2020/05/22/ADDefinitionOfDone.html):

* Evidence: something shows the choice works, such as a spike or the implemented issue.
* Criteria and alternatives: at least two real options were compared against the drivers.
* Agreement: the decision makers challenged the choice and agreed to it.
* Documentation: the record exists and matches what was built.
* Realization and review: the decision is implemented, and the record says when to look at it again.

[How to create ADRs, and how not to](https://www.ozimmer.ch/practices/2023/04/03/ADRCreation.html)
names two traps worth avoiding here. A Mega-ADR packs design details, implementation plans and code
into the record. A Blueprint in disguise reads like a rulebook. Rules that contributors have to
follow belong in CLAUDE.md or CONTRIBUTING.md, and the record explains the decision behind them.
[How to review ADRs](https://www.ozimmer.ch/practices/2023/04/05/ADRReview.html) has a checklist for
reviewing a record.

## Dates and format

A record's `date` is the day the decision was last updated, as in MADR. A proposed record that a
later issue extends gets that issue's date. Where a record was written after the decision was made,
its `date` is the date of the original decision.

The template follows MADR 4.0.0 with sentence-case headings. The records live in `docs/adr/`
instead of MADR's suggested `docs/decisions/`, which MADR allows.

## Index

| No. | Decision | Status |
|---|---|---|
| [0000](0000-use-madr-for-decisions.md) | Record decisions in MADR, keep specs and plans out of the repo | accepted |
| [0001](0001-rls-is-the-security-boundary.md) | Row Level Security is the only security boundary | accepted |
| [0002](0002-replace-venues-in-one-rpc.md) | Replace all venues atomically in one `security invoker` function | accepted |
| [0003](0003-report-errors-to-sentry-with-codes.md) | Report caught errors to Sentry and show a translated message with a code | accepted |
| [0004](0004-inline-styles-and-theme-module.md) | Style with inline style objects and a TypeScript theme module | accepted |
| [0005](0005-plain-map-without-mask-or-borders.md) | Show a plain map, without a mask outside Switzerland or canton borders | accepted |
| [0006](0006-precomputed-canton-bounds.md) | Precompute canton bounding boxes instead of shipping geometry | accepted |
| [0007](0007-url-parameters-without-a-router.md) | Read URL parameters once, without a router | accepted |
| [0008](0008-imperative-leaflet-and-static-popups.md) | Drive Leaflet imperatively and render popups to static HTML | accepted |
| [0009](0009-detect-browser-language-once.md) | Detect the browser language once and store it | accepted |
| [0010](0010-sidebar-filtering-and-sorting.md) | Filter the sidebar only, and ask for the location only on request | accepted |
| [0011](0011-venue-photo-galleries.md) | Store photo galleries in their own table and compress on the client | accepted |
| [0012](0012-posters-from-an-off-screen-map.md) | Build posters from an off-screen map drawn onto a canvas | accepted |
| [0013](0013-deploy-only-after-every-test-layer-passed.md) | Deploy from GitHub Actions only after every test layer passed | proposed |
| [0014](0014-test-in-three-layers.md) | Test in three layers: unit, integration against the local stack, and Gherkin end to end | proposed |
