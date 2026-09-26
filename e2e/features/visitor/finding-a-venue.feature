Feature: Finding a Schwingkeller
  A visitor looks for a place to train, without signing in.

  Background:
    Given I visit the map

  Scenario: Searching by name
    When I search for "Mythen"
    Then the list shows "Mythen Schwingkeller" and no other venue

  Scenario: Searching by town
    When I search for "Burgdorf"
    Then the list shows "Turnhalle Schlossmatt"

  Scenario: A search without a match
    When I search for "Zzyzx"
    Then the list says that nothing was found

  Scenario: Showing only outdoor venues
    When I show only outdoor venues
    Then the list shows "Schwinghalle Grand-Pré"
    And the list does not show "Schwingkeller Freiburg-Altstadt"
