@tablet
Feature: The map on a tablet
  On a tablet the venue list is a panel over the left edge of the map. It starts closed, and a tab
  on its edge opens it, by a tap or by dragging it sideways.

  Background:
    Given I visit the map
    Then the map shows the tablet layout

  Scenario: The venue list starts closed and its tab opens it
    Then the venue panel is closed
    When I tap the tab of the venue panel
    Then the venue panel is open
    When I tap the tab of the venue panel
    Then the venue panel is closed

  Scenario: Dragging the venue panel open and closed
    When I drag the venue panel open
    Then the venue panel is open
    When I drag the venue panel closed
    Then the venue panel is closed

  Scenario: Opening a venue from the panel
    When I tap the tab of the venue panel
    And I search for "Escholzmatt"
    And I open "Schwingkeller Escholzmatt" from the list
    Then the details of "Schwingkeller Escholzmatt" are open
