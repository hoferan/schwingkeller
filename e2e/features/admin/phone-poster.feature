@phone @verband-view
Feature: Poster for a Verband on a phone
  Below 700px the poster editor previews the poster at 270px instead of 540px, so the export is
  drawn two zoom levels above the preview instead of one. The preview places the names from pin
  positions rounded to its own pixels, so its count can differ from the poster's (#155). For
  Freiburg the phone preview shows 10 names like the downloaded poster, and the 540px preview 11.

  Background:
    Given I am signed in as the admin
    Then the map shows the phone layout
    When I tap the header of the venue list

  Scenario: The preview is half the desktop size
    When I open the poster editor for Verband "Freiburg"
    Then the preview is 270 pixels wide

  # The default zoom is capped so that the export is at zoom 15 at most, whatever the preview size.
  Scenario: A Verband with one venue opens one zoom level lower than on a desktop
    When I open the poster editor for Verband "Schwyz"
    Then the preview shows the map at zoom 13

  Scenario: Venue names label the pins without overlapping
    When I open the poster editor for Verband "Freiburg"
    Then 10 venue names label the pins
    And no two names overlap

  Scenario: Downloading the poster
    When I open the poster editor for Verband "Freiburg"
    And I download the poster
    Then I get the file "schwingkeller-freiburg.png"
    And it is a 1080x1080 PNG
    And the export draws its map 2 zoom levels above the preview
