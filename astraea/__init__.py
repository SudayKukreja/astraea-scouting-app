import os

from dotenv import load_dotenv
from flask import Flask

load_dotenv()


def create_app():
    from astraea.routes import analytics, data, events, pages

    app = Flask(__name__)
    app.secret_key = os.environ.get('SECRET_KEY') or os.urandom(24)

    for module in (pages, data, events, analytics):
        app.register_blueprint(module.bp)
    return app
