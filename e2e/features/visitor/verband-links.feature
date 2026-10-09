@verband-view
Feature: Links to a Verband
  A shared or printed link opens the map on a Verband.

  Scenario: A Verband link opens that Verband
    When I follow a shared link to Verband "Emmental"
    Then the list shows exactly the venues of Verband "Emmental"

  Scenario: A link to a Verband without venues says so
    When I follow a shared link to Verband "Berner Jura"
    Then the list says that Verband "Berner Jura" has no venues yet

  Scenario: An old canton link opens its Verband
    When I follow a shared link to canton "FR"
    Then the list shows exactly the venues of Verband "Freiburg"
