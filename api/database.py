import os
from dotenv import load_dotenv

from sqlalchemy import MetaData, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()
load_dotenv(".env.local")
db_url = os.environ.get("SQL_DB_URL") or os.environ.get("DATABASE_URL")

if not db_url:
	raise RuntimeError("Set SQL_DB_URL or DATABASE_URL to your TigerData PostgreSQL URL")

database_url = make_url(db_url)
if database_url.drivername in {"postgres", "postgresql"}:
	database_url = database_url.set(drivername="postgresql+psycopg")
	if "sslmode" not in database_url.query:
		database_url = database_url.update_query_dict({"sslmode": "require"})

engine = create_engine(
	database_url,
	echo=os.environ.get("SQL_ECHO", "false").lower() == "true",
	pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()