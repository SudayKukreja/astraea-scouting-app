from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS

# Google Sheets API setup
SERVICE_ACCOUNT_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1FN0yuBTIiUTbzGpVxh0UG_l6YYhtbHlxfNxuNgUkE10'

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
service = build('sheets', 'v4', credentials=creds)
sheet = service.spreadsheets()

# Routes
@app.route('/', methods=['GET'])
def form():
    return render_template('index.html')

@app.route('/submit', methods=['POST'])
def submit():
    data = request.json

    name = data.get('name')
    team = data.get('team')
    match_number = data.get('match_number')
    submitted_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    auto = data.get('auto', {})
    teleop = data.get('teleop', {})
    endgame = data.get('endgame', {})
    notes = data.get('notes', '')  # New notes field

    values = [[
        name,
        team,
        match_number,
        submitted_time,

        auto.get('ll1', 0),
        auto.get('l2', 0),
        auto.get('l3', 0),
        auto.get('l4', 0),
        auto.get('processor', 0),
        auto.get('barge', 0),

        teleop.get('ll1', 0),
        teleop.get('l2', 0),
        teleop.get('l3', 0),
        teleop.get('l4', 0),
        teleop.get('processor', 0),
        teleop.get('barge', 0),
        teleop.get('offense_rating', 0),
        teleop.get('defense_rating', 0),

        endgame.get('parked', 'No'),
        endgame.get('climbed', 'No'),
        endgame.get('climb_type', ''),

        notes  # Include notes as last column
    ]]

    body = {'values': values}

    # Append the data to the spreadsheet
    sheet.values().append(
        spreadsheetId=SPREADSHEET_ID,
        range='Sheet1!A:Z',
        valueInputOption='RAW',
        body=body
    ).execute()

    return jsonify({'status': 'success'})

# Run the app
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
