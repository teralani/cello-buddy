from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func

from api.models.connections import Connections
from api.models.users import Users
from api.models.practice_sessions import PracticeSessions

from api.schemas.ConnectionsBase import ConnectionsBase
from api.schemas.PracticeSessionsBase import PracticeSessionsBase

from api.schemas.UsersBase import UsersBase, UserLogin

from api.db_dep import db_dep

connection_router = APIRouter(prefix="/connection", tags=["Connection"])

@connection_router.get("/get-specific-connection/{user1_id}{user2_id}/", status_code=status.HTTP_200_OK)
def get_specific_connection(user1_id: int, user2_id: int, db: db_dep):
    db_connection = db.query(Connections).filter(Users.user_id == user1_id and Users.user_id == user2_id).first()
    if db_connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection does not exist")
    else:
        return db_connection

@connection_router.get("/get-user-connections/{user_id}/", status_code=status.HTTP_200_OK)
def get_specific_connection(user_id: int, db: db_dep):
    db_connections = db.query(Connections).filter(Connections.user1_id == user_id).all()
    if db_connections is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User does not have any connections")
    else:
        return db_connections

@connection_router.post("/make-connection/{user1_id}{user2_id}/", status_code=status.HTTP_201_CREATED)
def create_connection(connection: ConnectionsBase, user1_id: int, user2_id: int, db: db_dep):
    db_connection = Connections(**connection.model_dump())
    db_connection.user1_id = user1_id;
    db_connection.user2_id = user2_id;

    db.add(db_connection)
    db.commit()
    db.refresh(db_connection)
    return db_connection 

@connection_router.delete("/delete-connection/{user1_id}{user2_id}/", status_code=status.HTTP_202_ACCEPTED)
def delete_connection(user1_id: int, user2_id: int, db: db_dep):
    db_connection = db.query(Connections).filter(Users.user_id == user1_id and Users.user_id == user2_id).first()
    if db_connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection does not exist")
    db.delete(db_connection)
    db.commit()
