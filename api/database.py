import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

from sqlalchemy import *
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()
db_url = os.environ.get('SQL_DB_URL')

engine = create_engine(db_url, echo=True)

metadata = MetaData()
metadata.reflect(bind=engine)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()