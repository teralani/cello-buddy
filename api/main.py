from fastapi import FastAPI
import uvicorn 

from sqlalchemy import inspect
from api.database import engine, Base
from api.auth import router
from api.api_groups.user_api import user_router
from api.api_groups.practice_session_api import practice_session_router
from api.api_groups.connection_api import connection_router


from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import parse_qsl, urlencode

# On Vercel this module is deployed as the Python function at /api/main, and
# next.config.ts rewrites /api/py/* to it. The function receives the original
# request path, so without help every route here would have to start with
# /api/py. This middleware strips that prefix instead, which keeps the routes
# unchanged for a local `uvicorn api.main:app`, where no prefix is present.
PATH_PREFIX = "/api/py"
# The path Vercel serves this module at. Next's rewrite passes the matched
# remainder of the URL as a `path` query parameter alongside the request.
FUNCTION_PATH = "/api/main"


class StripPathPrefix:
    """ASGI middleware that removes a path prefix from incoming requests when it is present.

    Requests that arrive at the function's own path carry the real route in the
    `path` query parameter instead; those are unpacked the same way.
    """

    def __init__(self, app, prefix: str, function_path: str | None = None):
        self.app = app
        self.prefix = prefix.rstrip("/")
        self.function_path = function_path

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            path = scope.get("path", "")
            if path == self.prefix or path.startswith(self.prefix + "/"):
                scope = dict(scope)
                scope["path"] = path[len(self.prefix):] or "/"
                # root_path keeps generated URLs (docs, redirects) under the prefix.
                scope["root_path"] = scope.get("root_path", "") + self.prefix
            elif self.function_path and path == self.function_path:
                params = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
                routed = [value for key, value in params if key == "path"]
                if routed:
                    scope = dict(scope)
                    scope["path"] = "/" + routed[0].lstrip("/")
                    scope["query_string"] = urlencode([(k, v) for k, v in params if k != "path"]).encode("latin-1")
                    scope["root_path"] = scope.get("root_path", "") + self.prefix
        await self.app(scope, receive, send)


app = FastAPI()

origins = ["http://localhost:5173"]


app.add_middleware(StripPathPrefix, prefix=PATH_PREFIX, function_path=FUNCTION_PATH)
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
