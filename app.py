import os

from astraea import create_app

app = create_app()

if __name__ == '__main__':
    host = os.environ.get('HOST', '127.0.0.1')
    port = int(os.environ.get('PORT', 5001))
    print(f'Astraea Scouting running at http://localhost:{port}')
    app.run(host=host, port=port)
