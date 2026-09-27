from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func

from api.models.users import Users
from api.models.practice_sessions import PracticeSessions

from api.schemas.PracticeSessionsBase import PracticeSessionsBase

from api.schemas.UsersBase import UsersBase, UserLogin

from api.db_dep import db_dep

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

@practice_session_router.get("/user-ordered-scores/{user_id}", status_code=status.HTTP_200_OK)
def user_ordered_scores(user_id: int, db: db_dep):
    sessions = (
        db.query(PracticeSessions)
        .filter(PracticeSessions.user_id == user_id)
        .order_by(
            PracticeSessions.final_score.desc(),
            PracticeSessions.time_created.desc(),  # tiebreaker: newer first
        )
        .all()
    )
    data = [
        {
            "practice_session_id": s.practice_session_id,
            "notes_correct": round(float(s.notes_correct) * 100, 1),
            "correct_bow_pos": round(float(s.correct_bow_pos) * 100, 1),
            "articulation": round(float(s.articulation) * 100, 1),
            "final_score": round(float(s.final_score) * 100, 1),
            "time_created": s.time_created,
        }
        for s in sessions
    ]
    return data

@practice_session_router.get("/all-user-high-scores", status_code=status.HTTP_200_OK) 
def high_score_leaderboard(db: db_dep):
    leaderboard = (
        db.query(
            PracticeSessions.user_id,
            func.max(PracticeSessions.final_score).label("high_score"),
        )
        .group_by(PracticeSessions.user_id)
        .order_by(func.max(PracticeSessions.final_score).desc())
        .all()
    )

    data = [{"user_id": row.user_id, "high_score": row.high_score * 100} for row in leaderboard]
    return data


# to do right now
#   compile cello practice videos, extract transcripts with api, make word phrase list for each requirment and map
#   depending on values of the scores (and their weightage) --> 0.4, 0.35, 0.25 --> suggest videos 
#   