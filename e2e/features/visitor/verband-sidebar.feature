@verband-view
Feature: Finding a Schwingkeller by Verband
  With the Verband view, the sidebar groups venues by Teilverband and Verband, and the search
  knows their names.

  Background:
    Given I visit the map

  Scenario: The sidebar groups venues by Teilverband
    Then the Teilverbände are listed in this order: BKSV, ISV, NOSV, NWSV, SWSV
    # NOSV is left out: admin scenarios add venues in Graubünden while this runs.
    And the Teilverbände count these venues:
      | Teilverband | venues |
      | BKSV        | 4      |
      | ISV         | 4      |
      | NWSV        | 0      |
      | SWSV        | 15     |

  Scenario: Opening a Verband lists its venues, wherever they are
    When I open the Verband "Emmental"
    Then the list shows exactly the venues of Verband "Emmental"
    And the list shows "Schwingkeller Escholzmatt"

  Scenario: Searching by Verband name
    When I search for "Wallis"
    Then the list shows exactly the venues of Verband "Wallis"

  Scenario: Searching by Teilverband abbreviation
    When I search for "ISV"
    Then the list shows exactly the venues of Teilverband "ISV"
