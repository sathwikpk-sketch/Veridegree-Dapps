from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    sepolia_rpc_url: str = ""
    contract_address: str = ""
    chain_id: int = 11155111
    contract_deployment_block: int = -1
    session_secret: str = ""
    session_ttl_minutes: int = 30
    app_domain: str = "localhost:3000"
    cors_origins: str = "http://localhost:3000"
    database_path: str = "./data/veridegree.sqlite3"
    event_poll_seconds: int = 5
    event_block_step: int = 500
    event_confirmations: int = 3
    event_reorg_checkpoints: int = 128
    max_upload_mb: int = 12

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache

def get_settings() -> Settings:
    return Settings()
