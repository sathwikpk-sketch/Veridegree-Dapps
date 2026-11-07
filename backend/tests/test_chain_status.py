from app.status import credential_status


def test_active_unrevoked_issuer_is_valid():
    assert credential_status(True, True) == "valid"


def test_revocation_takes_precedence_over_issuer_approval():
    assert credential_status(False, True) == "revoked"
    assert credential_status(False, False) == "revoked"


def test_unrevoked_credential_from_removed_issuer_is_not_valid():
    assert credential_status(True, False) == "issuer_unapproved"
