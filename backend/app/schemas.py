from pydantic import BaseModel, Field


class ChallengeRequest(BaseModel):
    address: str = Field(min_length=42, max_length=42)


class VerifySignatureRequest(BaseModel):
    address: str = Field(min_length=42, max_length=42)
    message: str = Field(min_length=20, max_length=2000)
    signature: str = Field(min_length=130, max_length=132)

