from pydantic import BaseModel, field_validator


class ConnectionsBase(BaseModel):
    user1_id: int
    user2_id: int

    
