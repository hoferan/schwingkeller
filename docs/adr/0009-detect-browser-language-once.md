---
status: accepted
date: 2026-07-14
decision-makers: André Hofer
---

# Detect the browser language once and store it

## Context and problem statement

First-time visitors who speak French or Italian saw German, and had to find the language switcher
before they could read anything.

## Considered options

* A language detection package from npm
* Read `navigator.languages` ourselves

## Decision outcome

Chosen option: read `navigator.languages` ourselves, once.

* On first visit, walk `navigator.languages` in order and take the first entry whose primary subtag
  is `de`, `fr` or `it`. If none matches, use German. That covers Romansh and English speakers too.
* Store the result in `localStorage` (`schwing_lang`) straight away, so detection never runs again.
* A stored value is validated before use.
* A package would still hand back raw BCP 47 tags that need the same mapping, so it wasn't worth the
  dependency.

### Consequences

* Good, because most visitors land in their language, and a choice made in the switcher sticks.
* Bad, because changing the browser language later has no effect once a value is stored. That's
  intentional: the stored value is treated as the user's choice.

## More information

`src/i18n/useTranslation.ts`
