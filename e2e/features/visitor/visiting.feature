Feature: Visiting the map
  Anyone can use the map without an account.

  Scenario: A visitor sees no editing controls
    Given I visit the map
    Then there is no button to add a venue
    And no canton offers a poster

  Scenario: Switching the language to French
    Given I visit the map
    When I switch the language to French
    Then the interface is in French

  Scenario: Widening the venue list
    Given I visit the map
    When I drag the edge of the venue list to 450 pixels
    Then the venue list is 450 pixels wide
    When I come back to the map later
    Then the venue list is 450 pixels wide
