Feature: Adding a venue
  A signed-in admin adds a Schwingkeller to the map.

  Background:
    Given I am signed in as the admin

  Scenario: A new venue can be found by name
    When I add a venue in canton "GR"
    Then searching for its name shows it

  Scenario: Saving a venue stores it exactly once
    When I add a venue in canton "GR"
    Then exactly one venue with its name is stored
