Feature: What each editor level may edit
  An editor works on the venues of their own Verband or Teilverband. Everything else stays read-only.

  Scenario: A Teilverband editor edits the venues of all its Verbände
    Given I am signed in as the "bksv" editor
    When I open "Schwingkeller Emmental" from the list
    Then the details offer editing

  Scenario: A Teilverband editor can't edit venues of another Teilverband
    Given I am signed in as the "bksv" editor
    When I open "Schwingerkeller Allmend" from the list
    Then the details don't offer editing

  Scenario: A Teilverband editor edits a venue in a second Verband
    Given I am signed in as the "bksv" editor
    When I open "Schwinghalle Boden" from the list
    Then the details offer editing

  Scenario: A Teilverband editor adds venues to its own Verbände only
    Given I am signed in as the "bksv" editor
    When I start adding a venue
    Then the Verband choices are exactly: Berner Jura, Emmental, Mittelland, Oberaargau, Oberland, Seeland

  Scenario: A Teilverband editor gets a poster for a Verband in scope
    Given I am signed in as the "bksv" editor
    When I open the Teilverband "BKSV"
    Then Verband "Emmental" offers a poster

  Scenario: A Teilverband editor gets no poster for a Verband of another Teilverband
    Given I am signed in as the "bksv" editor
    When I open the Teilverband "ISV"
    Then Verband "Luzern" doesn't offer a poster

  Scenario: A Verband editor edits its own venues
    Given I am signed in as the "emmental" editor
    When I open "Schwingkeller Emmental" from the list
    Then the details offer editing

  Scenario: A Verband editor can't edit venues of a neighbouring Verband
    Given I am signed in as the "emmental" editor
    When I open "Schwinghalle Boden" from the list
    Then the details don't offer editing

  Scenario: A Verband editor can't edit venues of another Teilverband
    Given I am signed in as the "emmental" editor
    When I open "Schwingerkeller Allmend" from the list
    Then the details don't offer editing

  Scenario: A Verband editor adds venues to its own Verband
    Given I am signed in as the "emmental" editor
    When I start adding a venue
    Then the Verband choices are exactly: Emmental
    And the Verband "Emmental" is preselected

  Scenario: An account waiting for approval can't edit
    Given I am signed in as the "pending" editor
    When I open "Schwingkeller Emmental" from the list
    Then the details don't offer editing

  Scenario: An account waiting for approval can't add venues
    Given I am signed in as the "pending" editor
    Then I see that my account is waiting for approval
    And there is no button to add a venue
