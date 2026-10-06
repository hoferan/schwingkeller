---
status: proposed
date: 2026-10-06
decision-makers: André Hofer
---

# Organise venues by Schwingerverband, keep the canton as geography

## Context and problem statement

The app groups, links and frames venues by canton. The Schwinger scene organises itself by
Verband instead: the ESV has 5 Teilverbände and 29 Kantonal- and Gauverbände, and they don't line
up with the cantons. Bern is one Teilverband (BKSV) split into 6 Gauverbände along its
Verwaltungskreise. Appenzell covers AR and AI, and Ob- und Nidwalden covers OW and NW. A club near
a border can belong to the Verband of the neighbouring canton. The question was how venues should
carry that structure. It came up in a design session for the
[Verband hierarchy](https://github.com/hoferan/schwingkeller/milestone/1) milestone.

## Decision drivers

* Officials and visitors should find a venue under the Verband they know.
* Bern, the shared Verbände and clubs that cross a border have to come out right.
* Permissions in the [user management](https://github.com/hoferan/schwingkeller/milestone/2)
  milestone need the same structure.
* The current canton UI has to keep working while the new view is reviewed.

## Considered options

* Keep the canton grouping and show the Verband as a label
* Work out the Verband from the canton when it's needed, without storing it
* Store a node of the ESV tree on each venue, suggested from the address and editable

## Decision outcome

Chosen option: store a node of the ESV tree on each venue.

* The tree is ESV, then Teilverband, then Kantonal- or Gauverband. A venue always points at one of
  the 29 leaves, and its Teilverband follows from the tree.
* The editor picks the Verband from a fixed list, and the form suggests nothing: an address says
  little about club membership, and an automatic guess the editor doesn't notice ends up stored.
  A home-area table (canton, or Verwaltungskreis inside Bern, to Verband) served the one-off
  backfill and frames a Verband that has no venues yet.
* The canton stays on the venue as geography: address, coat of arms, search by canton name.
  Grouping, counts, links, posters and permissions use the Verband.
* Whatever the UI shows for a Verband comes from the Verband itself (its name, and a dot in its
  Teilverband's colour) or from its venues (bounds, counts), never from a canton. Canton arms on
  Verband rows were turned down because a Verband can span cantons and a venue can sit outside its
  Verband's home cantons.
* Identifiers in the schema and the code are English: `associations`, `association_id`, and the
  levels `federation`, `regional` and `cantonal`. Values stay German, because the slugs,
  abbreviations and names are proper names and the slugs appear on posters and in URLs. The levels
  are rows of their own table, so a club level would be one more row.
* A venue always sits on the lowest level, today one of the 29. The levels above it exist for
  editor scopes ([ADR 0016](0016-editor-scope-is-a-verband-node.md)). Schwingklubs were left out
  for now. Adding them means one more level below the 29, and a migration that moves each venue to
  its club and changes the level the database accepts on a venue.
* The frontend carries the tree as static data, next to the names, colours and home-area boxes it
  needs anyway, and components reach it through one hook. The database stays the authority for
  foreign keys and RLS, and an integration test fails when the two copies differ. Loading the tree
  at runtime was turned down: it only changes with a migration and a deploy, and it would give the
  sidebar, form and poster a loading state to handle.
* A label on the canton grouping would keep the structure the scene doesn't use. Working the
  Verband out from the canton fails in Bern without reverse geocoding, and fails for every club
  across a border.

### Consequences

* Good, because sidebar, permalinks, posters and editor scopes all read one attribute.
* Good, because a club across a border only needs a different pick in the dropdown.
* Bad, because Bernese venues need a one-off reverse-geocoding backfill to find their Gau.
* Bad, because tree ids end up on printed posters and in URLs, so they can't be renamed once
  shipped.
* The canton and Verband views both run until the switch, behind the flag from
  [ADR 0017](0017-feature-flags-from-one-registry.md).

### Confirmation

A database trigger rejects an `association_id` that isn't on the cantonal level, the lowest one, and
a seed test checks every row has a valid one. An integration test compares the frontend's copy of
the tree with the database. The cross-border seed venue, filed under a Verband outside its canton,
covers that case in the grouping and permalink tests.

## More information

* Tree, home areas and backfill: [#63](https://github.com/hoferan/schwingkeller/issues/63), Bern:
  [#64](https://github.com/hoferan/schwingkeller/issues/64)
* Frontend data, marks and suggestion: [#65](https://github.com/hoferan/schwingkeller/issues/65),
  UI: [#66](https://github.com/hoferan/schwingkeller/issues/66) to
  [#69](https://github.com/hoferan/schwingkeller/issues/69)
* Switch and cleanup: [#71](https://github.com/hoferan/schwingkeller/issues/71),
  [#72](https://github.com/hoferan/schwingkeller/issues/72)
* Revisit when Schwingklubs are added to the tree.
