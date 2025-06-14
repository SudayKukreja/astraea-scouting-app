from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime

app = Flask(__name__)
CORS(app)

SERVICE_ACCOUNT_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1FN0yuBTIiUTbzGpVxh0UG_l6YYhtbHlxfNxuNgUkE10'

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
service = build('sheets', 'v4', credentials=creds)
sheet = service.spreadsheets()

# Define team blocks: team_number -> starting row in Sheet1 (1-indexed)
team_blocks = {
    '6897': 1,
    '1923': 7,
    '4573': 13,
}
BLOCK_SIZE = 6        # total rows per team block (title + header + 4 data)
HEADER_ROWS = 2       # 1 for team title, 1 for column labels
MAX_DATA_ROWS = BLOCK_SIZE - HEADER_ROWS  # match data slots per team

def get_next_empty_row_for_team(team):
    start_row = team_blocks.get(team)
    if start_row is None:
        return None  

    data_start_row = start_row + HEADER_ROWS
    data_end_row = start_row + BLOCK_SIZE - 1

    range_name = f'Sheet1!A{data_start_row}:V{data_end_row}'
    result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=range_name).execute()
    values = result.get('values', [])

    for i in range(MAX_DATA_ROWS):
        if i >= len(values) or len(values[i]) == 0 or values[i][0] == '':
            return data_start_row + i
    return None 

@app.route('/', methods=['GET'])
def form():
    return render_template('index.html')

@app.route('/submit', methods=['POST'])
def submit():
    data = request.json

    name = data.get('name')
    team = str(data.get('team'))
    match_number = data.get('match_number')
    submitted_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    auto = data.get('auto', {})
    teleop = data.get('teleop', {})
    endgame = data.get('endgame', {})
    notes = data.get('notes', '') 

    next_row = get_next_empty_row_for_team(team)
    if next_row is None:
        return jsonify({'status': 'error', 'message': f'Team {team} block full or missing.'}), 400

    values = [[
        name, team, match_number, submitted_time,
        auto.get('ll1', 0), auto.get('l2', 0), auto.get('l3', 0), auto.get('l4', 0),
        auto.get('processor', 0), auto.get('barge', 0),
        teleop.get('ll1', 0), teleop.get('l2', 0), teleop.get('l3', 0), teleop.get('l4', 0),
        teleop.get('processor', 0), teleop.get('barge', 0),
        teleop.get('offense_rating', 0), teleop.get('defense_rating', 0),
        endgame.get('parked', 'No'), endgame.get('climbed', 'No'),
        endgame.get('climb_type', ''), notes
    ]]

    body = {'values': values}

    range_write = f'Sheet1!A{next_row}:V{next_row}'
    sheet.values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=range_write,
        valueInputOption='RAW',
        body=body
    ).execute()

    return jsonify({'status': 'success', 'message': f'Added to team {team} at row {next_row}.'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
