@phone @verband-view
Feature: Poster for a Verband on a phone
  Below 700px the poster editor previews the poster at 270px instead of 540px, so the export is
  drawn two zoom levels above the preview instead of one. At that framing two of Freiburg's
  venues, about 135m apart, leave one of them no free spot for its name, so it shows 10 names where
  the desktop shows 11.

  Background:
    Given I am signed in as the admin
    Then the map shows the phone layout
    When I tap the header of the venue list
    And I open the poster editor for Verband "Freiburg"

  Scenario: The preview is half the desktop size
    Then the preview is 270 pixels wide

  Scenario: Venue names label the pins without overlapping
    Then 10 venue names label the pins
    And no two names overlap

  Scenario: Downloading the poster
    When I download the poster
    Then I get the file "schwingkeller-freiburg.png"
    And it is a 1080x1080 PNG
    And the export draws its map 2 zoom levels above the preview
