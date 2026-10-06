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

  Scenario: A new venue is stored with the association chosen for it
    When I add a venue in canton "GR"
    Then it is stored with the association "graubuenden"

  Scenario: A venue without an association isn't saved
    When I try to add a venue in canton "GR" without an association
    Then the form asks for an association
    And no venue with its name is stored
