@editors
Feature: Applying for an editor account
  An official applies with the Verband they work for. The account then waits for an admin's approval.

  Scenario: An official applies and waits for approval
    Given I visit the map
    When I apply for an account for the Verband "Emmental"
    Then I see that my account is waiting for approval
    And my application names the Verband "Emmental"
