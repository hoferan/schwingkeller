@phone @editors
Feature: Managing accounts on a phone
  On a phone the account panel fills the screen and lists accounts and invitations as cards, where
  a wider screen shows a table.

  Scenario: Accounts are listed as cards
    Given an applicant has applied for the Verband "Emmental"
    And I am signed in as the "esv" editor
    Then the map shows the phone layout
    When I open the account list
    Then the account panel fills the screen
    And the applicant is listed as a card

  Scenario: Open invitations are listed as cards
    Given I am signed in as the "emmental" editor
    Then the map shows the phone layout
    When I invite the applicant from the invitations panel
    And I close the invitation dialog
    Then the account panel fills the screen
    And the applicant's invitation is listed as a card
