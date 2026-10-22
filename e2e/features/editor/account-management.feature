Feature: Managing editor accounts
  Super-admins and Teilverband editors change, suspend and remove editor accounts.

  Scenario: A super-admin moves an editor to another scope
    Given an applicant is an editor for the Verband "Emmental"
    And I am signed in as the "esv" editor
    When I open the account list showing approved accounts
    And I change the applicant's scope to "Seeland"
    Then the applicant is an editor for the Verband "Seeland"

  Scenario: A super-admin suspends and reactivates an editor
    Given an applicant is an editor for the Verband "Emmental"
    And I am signed in as the "esv" editor
    When I open the account list showing approved accounts
    And I suspend the applicant
    Then the applicant's account is "suspended"
    When I show the "suspended" accounts
    And I reactivate the applicant
    Then the applicant is an editor for the Verband "Emmental"

  Scenario: A super-admin deletes an account after confirming
    Given an applicant has applied for the Verband "Emmental"
    And I am signed in as the "esv" editor
    When I open the account list
    And I delete the applicant and confirm
    Then the applicant can no longer sign in

  Scenario: A Teilverband editor can't delete accounts
    Given an applicant is an editor for the Verband "Emmental"
    And I am signed in as the "bksv" editor
    When I open the account list showing approved accounts
    Then the applicant's row offers no delete
