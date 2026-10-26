@editors
Feature: Inviting editors
  An approved editor invites a person to their Verband and can take the invitation back.

  Scenario: A Verband editor invites someone who then signs up
    Given I am signed in as the "emmental" editor
    When I invite the applicant from the invitations panel
    Then the invitation link is shown once
    When I close the invitation dialog
    And I sign out
    And the applicant opens the invitation link
    And the applicant chooses a password and creates the account
    Then the applicant is an editor for the Verband "Emmental"

  Scenario: A revoked invitation no longer works
    Given I am signed in as the "emmental" editor
    When I invite the applicant from the invitations panel
    And I close the invitation dialog
    And I revoke the applicant's invitation
    And I sign out
    And the applicant opens the invitation link
    Then I see that the invitation link is not valid

  Scenario: A Teilverband editor invites from the Einladungen tab
    Given I am signed in as the "bksv" editor
    When I open the account list
    And I invite the applicant to "Emmental" from the Einladungen tab
    Then the invitation link is shown once
    When I close the invitation dialog
    And I sign out
    And the applicant opens the invitation link
    And the applicant chooses a password and creates the account
    Then the applicant is an editor for the Verband "Emmental"
