@editors
Feature: Deleting my own account
  Anyone signed in can delete their account for good after retyping the password.

  Scenario: An applicant deletes their own account
    Given an applicant has applied for the Verband "Emmental"
    And I am signed in as the applicant
    When I delete my account with my password
    Then I see that my account has been deleted
    And the applicant can no longer sign in

  Scenario: A wrong password keeps the account
    Given an applicant has applied for the Verband "Emmental"
    And I am signed in as the applicant
    When I try to delete my account with the password "not-my-password"
    Then I'm told the password is wrong
    And the applicant's account is "pending"
