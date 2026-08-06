"""Application settings, loaded from environment variables / .env file."""

from pydantic_settings import BaseSettings, SettingsConfigDict


# The shipped placeholder. Checked into the repo, so anyone who knows an admin
# email could mint a valid token if a deployment ever ran with it.
INSECURE_DEFAULT_JWT_SECRET = "dev-only-insecure-secret-change-me-before-deploying"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "development" | "production". Anything other than development refuses to
    # start on the default JWT secret -- see check_production_safety().
    environment: str = "development"

    # --- Database ---
    # SQLite by default so the project runs with zero setup.
    # To move to Postgres later, change ONLY this value, e.g.
    #   postgresql+psycopg://user:pass@localhost:5432/edawr
    database_url: str = "sqlite:///./edawr.db"

    # --- Auth ---
    # Secret used to sign JWTs. MUST be overridden in production.
    # Needs to be >= 32 bytes or PyJWT warns that it is too weak for HS256.
    jwt_secret: str = INSECURE_DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12 hours

    # --- CORS ---
    # Origins allowed to call this API from a browser. The Next.js dev server
    # runs on :3000. Comma-separated when set via env var.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- Uploads ---
    # Where product images are written, and the public base path they are
    # served from. Files land in backend/uploads/ and are served at /uploads/*.
    upload_dir: str = "uploads"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment.strip().lower() == "development"


settings = Settings()


def check_production_safety() -> list[str]:
    """Refuse to boot outside development with insecure defaults.

    Called from the app lifespan. In development it returns warnings to print;
    anywhere else it raises, because a deployment signing tokens with a secret
    published in this repository is trivially forgeable.
    """
    problems: list[str] = []

    if settings.jwt_secret == INSECURE_DEFAULT_JWT_SECRET:
        problems.append(
            "JWT_SECRET is still the placeholder from .env.example. Generate one with:\n"
            '    python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )

    if not problems:
        return []

    if settings.is_development:
        return problems

    raise RuntimeError(
        "Refusing to start with ENVIRONMENT=%s and insecure configuration:\n  - %s"
        % (settings.environment, "\n  - ".join(problems))
    )
