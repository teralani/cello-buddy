from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc

from api.models.users import Users
from api.models.practice_sessions import PracticeSessions

from api.schemas.PracticeSessionsBase import PracticeSessionsBase

from api.schemas.UsersBase import UsersBase, UserLogin

from api.db_dep import db_dep
# from api.auth import create_access_token, get_current_user
# from api.auth import bcrypt_context

practice_session_router = APIRouter(prefix="/practice-session", tags=["PracticeSession"])

@practice_session_router.post("/create-practice-session/", status_code=status.HTTP_201_CREATED)
def create_practice_session(practice_session: PracticeSessionsBase, db: db_dep):
    db_practice = PracticeSessions(**practice_session.model_dump())
    db_practice.final_score = (
        float(db_practice.notes_correct) * 0.40
        + float(db_practice.correct_bow_pos) * 0.35
        + float(db_practice.articulation) * 0.25
    )
    db.add(db_practice)
    db.commit()
    db.refresh(db_practice)
    return db_practice

@practice_session_router.get("/practice-session/{practice_session_id}", status_code=status.HTTP_200_OK)
def get_practice_session(id: int, db: db_dep):
    db_practice = db.query(PracticeSessions).filter(PracticeSessions.practice_session_id == id).first()
    if db_practice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Practice session does not exist")
    else:
        return db_practice


@practice_session_router.get("/practice-session-scores/{practice_session_id}", status_code=status.HTTP_200_OK)
def get_practice_session_scores(id: int, db: db_dep):
    db_practice = db.query(PracticeSessions).filter(PracticeSessions.practice_session_id == id).first()
    if db_practice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Practice session does not exist")
    else:
        db_practice.final_score = (
            float(db_practice.notes_correct) * 0.40
            + float(db_practice.correct_bow_pos) * 0.35
            + float(db_practice.articulation) * 0.25
        )

        data = {
            "user_id" : db_practice.user_id,
            "notes_correct": float(db_practice.notes_correct) * 100.0,
            "correct_bow_pos": float(db_practice.correct_bow_pos) * 100.0,
            "articulation": float(db_practice.articulation) * 100.0,
            "final_score": float(db_practice.final_score) * 100.0,
        }   

        db.add(db_practice)
        db.commit()
        db.refresh(db_practice)

        print(data) # remove later, for testing purpose, WHY IS THIS E@HU#IEWLJUYWUCRUGRHEGDT#HBDJEGDYEDJUEU
        return data
        
@practice_session_router.get("/practice-session-recent/{user_id}", status_code=status.HTTP_200_OK)
def get_practice_session_scores(user_id: int, db: db_dep ):
    db_practice = db.query(PracticeSessions).filter(Users.user_id == user_id).order_by(PracticeSessions.time_created.desc()).first()
    if db_practice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Practice session does not exist")
    else:
        return db_practice
        
@practice_session_router.get("/practice-session-high/{user_id}", status_code=status.HTTP_200_OK) 
def get_high_score(user_id: int, db: db_dep):
    db_practice = db.query(PracticeSessions).filter(Users.user_id == user_id).order_by(desc(PracticeSessions.final_score)).first()
    if db_practice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Practice session does not exist")
    else:    
        return db_practice


# to do right now
#   compile cello practice videos, extract transcripts with api, make word phrase list for each requirment and map
#   depending on values of the scores (and their weightage) --> 0.4, 0.35, 0.25 --> suggest videos 
#   