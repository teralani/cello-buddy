from fastapi import FastAPI
import uvicorn 

from sqlalchemy import inspect
from api.database import engine, Base
from api.auth import router
from api.api_groups.user_api import user_router
from api.api_groups.practice_session_api import practice_session_router
from api.api_groups.connection_api import connection_router


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = ["http://localhost:5173"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(user_router)
app.include_router(practice_session_router)
app.include_router(connection_router)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)