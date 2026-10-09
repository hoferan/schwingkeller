Feature: Venue details
  A visitor opens a venue to see where it is and how to get there.

  Scenario: Opening a venue from the list
    Given I visit the map
    When I open "Mythen Schwingkeller" from the list
    Then I see the address "Schmiedgasse 5, 6430 Schwyz"
    And I can get directions to it

  Scenario: A shared link opens the venue
    When I follow a shared link to "Mythen Schwingkeller"
    Then the details of "Mythen Schwingkeller" are open

  Scenario: Clicking a pin opens the venue where the map is
    When I follow a shared link to canton "SZ"
    And I click the pin of "Mythen Schwingkeller"
    Then the popup of "Mythen Schwingkeller" is open
    And the map has kept its zoom

  Scenario: Opening a venue from its pin
    When I follow a shared link to canton "SZ"
    And I click the pin of "Mythen Schwingkeller"
    And I open the details from the popup
    Then the details of "Mythen Schwingkeller" are open

  Scenario: Closing the popup lets go of the venue
    When I follow a shared link to canton "SZ"
    And I click the pin of "Mythen Schwingkeller"
    Then "Mythen Schwingkeller" is selected
    When I close the popup
    Then no venue is selected

  @canton-view
  Scenario: A shared canton link shows that canton
    When I follow a shared link to canton "FR"
    Then the venues of canton "FR" are shown
