from sqlalchemy import *
from api.database import Base, engine


class Users(Base):
    __table__ = Table("user", Base.metadata, autoload_with=engine)