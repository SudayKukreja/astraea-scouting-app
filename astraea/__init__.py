import hmac
import os

from dotenv import load_dotenv
from flask import Flask, Response, request

load_dotenv()


def require_password():
    password = os.environ.get('APP_PASSWORD', '')
    if not password:
        if os.environ.get('RENDER'):
            return Response('Set APP_PASSWORD in the Render environment settings to use this app online.', 503)
        return None
    auth = request.authorization
    if auth and hmac.compare_digest((auth.password or '').encode(), password.encode()):
        return None
    return Response('Password required.', 401, {'WWW-Authenticate': 'Basic realm="Astraea Scouting"'})


def create_app():
    from astraea.routes import analytics, data, events, pages

    app = Flask(__name__)
    app.secret_key = os.environ.get('SECRET_KEY') or os.urandom(24)
    app.before_request(require_password)

    for module in (pages, data, events, analytics):
        app.register_blueprint(module.bp)
    return app
