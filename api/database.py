import os
from urllib.parse import quote_plus

from sqlalchemy import *
from sqlalchemy.orm import sessionmaker, declarative_base

db_url = os.environ.get('DB_URL')

engine = create_engine(SQL_DB_URL, echo=True)

metadata = MetaData()
metadata.reflect(bind=engine)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()