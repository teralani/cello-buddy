from sqlalchemy import *
from api.database import Base, engine


class Connections(Base):
    __table__ = Table("connection", Base.metadata, autoload_with=engine)