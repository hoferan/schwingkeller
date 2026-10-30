@phone
Feature: The map on a phone
  On a narrow screen the venue list is a sheet at the bottom of the map. It shows a strip until
  someone opens it, by tapping its header or by dragging it up.

  Background:
    Given I visit the map
    Then the map shows the phone layout

  Scenario: The venue list starts as a strip and opens with a tap
    Then the venue list is a strip at the bottom
    When I tap the header of the venue list
    Then the venue list is open
    When I tap the header of the venue list
    Then the venue list is a strip at the bottom

  Scenario: Dragging the venue list up and down
    When I drag the venue list up
    Then the venue list is open
    When I drag the venue list down
    Then the venue list is a strip at the bottom

  Scenario: Opening a venue from the list
    When I tap the header of the venue list
    And I search for "Escholzmatt"
    And I open "Schwingkeller Escholzmatt" from the list
    Then the details of "Schwingkeller Escholzmatt" are open

  Scenario: The sign-in button is only an icon
    Then the sign-in button shows its icon without a label

  Scenario: The map legend starts closed
    Then the map legend is closed
