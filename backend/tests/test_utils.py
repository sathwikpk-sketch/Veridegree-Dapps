import hashlib


def test_sha256_bytes_are_stable_and_32_bytes():
    original = b"veridegree-test-certificate"
    digest = hashlib.sha256(original).digest()
    assert len(digest) == 32
    assert digest.hex() == hashlib.sha256(original).hexdigest()


def test_one_byte_change_changes_fingerprint():
    first = hashlib.sha256(b"certificate-v1").digest()
    second = hashlib.sha256(b"certificate-v2").digest()
    assert first != second
