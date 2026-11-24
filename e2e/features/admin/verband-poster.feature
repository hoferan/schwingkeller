Feature: Poster for a Verband
  An admin makes a poster of a Verband's venues to post online or print, with a QR code that leads
  back to it.

  Background:
    Given I am signed in as the admin
    And I open the poster editor for Verband "Freiburg"

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
    Then 10 venue names label the pins
    And no two names overlap

  Scenario: Every name stays inside the preview
    Then every venue name lies inside the preview

  Scenario: Switching the names off removes them
    Given the venue names are shown
    When I switch the venue names off
    Then no venue names are shown

  Scenario: The QR code leads to the Verband
    Then the QR code links to "/?vb=freiburg"

  Scenario: Downloading the poster
    When I download the poster
    Then I get the file "schwingkeller-freiburg.png"
    And it is a 1080x1080 PNG
    And the export draws its map 1 zoom level above the preview

  Scenario: Downloading the poster in landscape format
    When I choose the landscape format
    And I download the poster
    Then I get the file "schwingkeller-freiburg.png"
    And it is a 1080x720 PNG
