def credential_status(not_revoked: bool, issuer_approved: bool) -> str:
    """Resolve the dApp result while keeping revocation and issuer approval separate."""
    if not not_revoked:
        return "revoked"
    if not issuer_approved:
        return "issuer_unapproved"
    return "valid"
