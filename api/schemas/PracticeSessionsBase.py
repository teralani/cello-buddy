from datetime import datetime
from pydantic import BaseModel, field_validator


class PracticeSessionsBase(BaseModel):
    user_id: int
    notes_correct: float
    correct_bow_pos: float
    articulation: float
    time_created: datetime
    final_score: float

