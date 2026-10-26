@editors
Feature: Signing up through an invitation
  An official opens the link they were sent, sets a password and can edit their Verband's venues.

  Scenario: An invited official signs up
    Given the applicant has been invited to the Verband "Emmental"
    When the applicant opens the invitation link
    Then the sign-up form shows the applicant's address, locked, for "Emmental"
    When the applicant chooses a password and creates the account
    Then the welcome note names "Emmental"
    And the applicant is an editor for the Verband "Emmental"

  Scenario: A link that doesn't hold a valid invitation
    When I open an invitation link with an unknown token
    Then I see that the invitation link is not valid
