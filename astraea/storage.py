import json
import os
import threading
from contextlib import contextmanager

DATA_DIR = os.environ.get('DATA_DIR', 'data')
_lock = threading.RLock()


def _path(name):
    return os.path.join(DATA_DIR, name)


def load_json(name, default):
    try:
        with open(_path(name), 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(name, data):
    os.makedirs(DATA_DIR, exist_ok=True)
    path = _path(name)
    tmp = f'{path}.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


@contextmanager
def update_json(name, default):
    with _lock:
        data = load_json(name, default)
        yield data
        save_json(name, data)
