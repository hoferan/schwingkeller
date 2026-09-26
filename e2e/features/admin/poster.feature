Feature: Poster for a canton
  An admin makes a poster of a canton's venues to post online or print.

  Background:
    Given I am signed in as the admin
    And I open the poster editor for canton "FR"

  Scenario: Choosing the landscape format
    Then the formats square, portrait and landscape are offered
    And the square format is selected
    And the preview has an aspect ratio of 1:1
    When I choose the landscape format
    Then the landscape format is selected
    And the preview has an aspect ratio of 3:2

  Scenario: The format options sit on one row
    Then the format options are on a single row

  Scenario: Venue names label the pins without overlapping
    Then 11 venue names label the pins
    And no two names overlap

  Scenario: Every name stays inside the preview
    Then every venue name lies inside the preview

  Scenario: Switching the names off removes them
    Given the venue names are shown
    When I switch the venue names off
    Then no venue names are shown

  Scenario Outline: Downloading the poster in <format> format
    When I choose the <format> format
    And I download the poster
    Then I get the file "schwingkeller-fr.png"
    And it is a <width>x<height> PNG

    Examples:
      | format    | width | height |
      | landscape | 1080  | 720    |
      | square    | 1080  | 1080   |
