from pathlib import PurePosixPath


class InvalidCertificateFile(ValueError):
    """Raised when an uploaded certificate is not a supported file type."""


_ALLOWED = {
    ".pdf": ({"application/pdf"}, lambda data: data[:1024].lstrip().startswith(b"%PDF-")),
    ".png": ({"image/png"}, lambda data: len(data) >= 8 and data.startswith(b"\x89PNG\r\n\x1a\n")),
    ".jpg": ({"image/jpeg", "image/jpg"}, lambda data: len(data) >= 3 and data.startswith(b"\xff\xd8\xff")),
    ".jpeg": ({"image/jpeg", "image/jpg"}, lambda data: len(data) >= 3 and data.startswith(b"\xff\xd8\xff")),
}


def safe_filename(filename: str) -> str:
    # Normalise Windows separators too, even when the API runs on Linux.
    return PurePosixPath(filename.replace("\\", "/")).name or "certificate"


def validate_certificate_file(filename: str, content_type: str | None, contents: bytes) -> str:
    """Validate extension and file signature; MIME headers alone are not trusted."""
    safe_name = safe_filename(filename)
    suffix = PurePosixPath(safe_name).suffix.lower()
    rule = _ALLOWED.get(suffix)
    if rule is None:
        raise InvalidCertificateFile("Unsupported file type. Upload a PDF, JPG or PNG certificate.")

    allowed_mimes, signature_check = rule
    supplied_mime = (content_type or "").split(";", 1)[0].strip().lower()
    if supplied_mime and supplied_mime not in allowed_mimes and supplied_mime != "application/octet-stream":
        raise InvalidCertificateFile("The file type does not match its filename. Choose a PDF, JPG or PNG certificate.")
    if not signature_check(contents):
        raise InvalidCertificateFile("The file contents do not match the selected PDF, JPG or PNG type.")
    return safe_name
