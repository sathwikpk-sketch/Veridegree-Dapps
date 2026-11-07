import pytest

from app.uploads import InvalidCertificateFile, safe_filename, validate_certificate_file


def test_accepts_pdf_with_matching_signature():
    assert validate_certificate_file("degree.pdf", "application/pdf", b"%PDF-1.7\nexample") == "degree.pdf"


def test_accepts_png_with_matching_signature():
    png = b"\x89PNG\r\n\x1a\n" + b"data"
    assert validate_certificate_file("degree.png", "image/png", png) == "degree.png"


def test_rejects_mismatched_extension_and_signature():
    with pytest.raises(InvalidCertificateFile):
        validate_certificate_file("degree.pdf", "application/pdf", b"not a pdf")


def test_rejects_unsupported_file_type():
    with pytest.raises(InvalidCertificateFile):
        validate_certificate_file("degree.svg", "image/svg+xml", b"<svg></svg>")


def test_rejects_mismatched_mime_type():
    with pytest.raises(InvalidCertificateFile):
        validate_certificate_file("degree.png", "image/jpeg", b"\x89PNG\r\n\x1a\n")


def test_safe_filename_normalises_windows_path():
    assert safe_filename(r"C:\fakepath\degree.pdf") == "degree.pdf"
