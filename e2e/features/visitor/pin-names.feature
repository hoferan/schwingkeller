Feature: Venue names on the map
  A visitor sees which venue a pin or a cluster stands for, and reads the names once zoomed in.

  # Säntis Schwingkeller is more than 50 km from any other venue, so it stands alone at the starting
  # zoom; Halle Agy sits in the Fribourg cluster there, and alone at zoom 16, where picking it in the
  # list takes the map.

  Scenario: Hovering a pin shows its name
    Given I visit the map
    When I hover over the pin of "Säntis Schwingkeller"
    Then a tooltip shows "Säntis Schwingkeller"
    And the browser shows no tooltip of its own

  Scenario: A name waits for the pointer to rest on its pin
    Given I visit the map
    When I hover over the pin of "Säntis Schwingkeller"
    Then the tooltip waits a moment before it fades in
    And a tooltip shows "Säntis Schwingkeller"

  Scenario: Hovering a cluster lists its venues
    Given I visit the map
    When I hover over the cluster that holds "Halle Agy"
    Then the tooltip lists "Halle Agy"
    And the tooltip lists at most five names and says how many more

  Scenario: Zoomed in, names show without hovering
    Given I visit the map
    When I select "Halle Agy" in the list
    And I close the popup
    Then "Halle Agy" has its name next to its pin

  Scenario: Tapping a name opens its venue
    Given I visit the map
    When I select "Halle Agy" in the list
    And I close the popup
    And I tap the name next to "Halle Agy"
    Then the popup of "Halle Agy" is open
