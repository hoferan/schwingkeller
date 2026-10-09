@verband-view
Feature: Poster for a Verband
  An admin makes a poster of a Verband's venues, with a QR code that leads back to it.

  Background:
    Given I am signed in as the admin
    And I open the poster editor for Verband "Freiburg"

  Scenario: Venue names label the pins without overlapping
    Then 11 venue names label the pins
    And no two names overlap

  Scenario: The QR code leads to the Verband
    Then the QR code links to "/?vb=freiburg"

  Scenario: Downloading the poster
    When I download the poster
    Then I get the file "schwingkeller-freiburg.png"
    And it is a 1080x1080 PNG
