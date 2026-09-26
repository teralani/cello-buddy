from sqlalchemy import *
from api.database import Base, engine


class Users(Base):
    __table__ = Table("practice_session", Base.metadata, autoload_with=engine)