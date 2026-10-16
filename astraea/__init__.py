import os

from dotenv import load_dotenv
from flask import Flask

load_dotenv()


def create_app():
    from astraea.routes import admin, data, pages, scouting

    app = Flask(__name__)
    app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

    for module in (pages, scouting, admin, data):
        app.register_blueprint(module.bp)
    return app
