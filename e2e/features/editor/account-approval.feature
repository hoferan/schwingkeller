Feature: Approving editor accounts
  A Teilverband editor approves officials who applied for one of its Verbände.

  Scenario: A Teilverband editor approves an applicant for one of its Verbände
    Given an applicant has applied for the Verband "Emmental"
    And I am signed in as the "bksv" editor
    Then the account entry shows pending requests
    When I open the account list
    And I approve the applicant as "Emmental"
    Then the applicant is an editor for the Verband "Emmental"
