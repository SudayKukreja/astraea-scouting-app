import os

from astraea import create_app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f'Astraea Scouting running on http://localhost:{port}')
    app.run(host='0.0.0.0', port=port)
