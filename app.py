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

# Allowed teams list (strings)
ALLOWED_TEAMS = [
    "41", "316", "341", "365", "484", "694", "694B", "1218", "1599", "1599B",
    "1640", "1908", "1923", "2016", "2377", "2495", "2539", "2539B", "2607",
    "3136", "4099", "4575", "5113", "5113B", "5338", "5338B", "7414", "7770",
    "9015", "10584"
]

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

    if team not in ALLOWED_TEAMS:
        return jsonify({'status': 'error', 'message': f'Team {team} is excluded or not recognized.'}), 400

    auto = data.get('auto', {})
    teleop = data.get('teleop', {})
    endgame = data.get('endgame', {})
    notes = data.get('notes', '')

    data_row = [
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

        notes
    ]

    empty_row = [''] * 26
    team_header = [f'Team {team}'] + [''] * 25
    column_headers = [
        "Scouter Name", "Team Number", "Match Number", "Submission Time",
        "Auto L1", "Auto L2", "Auto L3", "Auto L4", "Auto Processor", "Auto Barge",
        "Teleop L1", "Teleop L2", "Teleop L3", "Teleop L4", "Teleop Processor", "Teleop Barge",
        "Offense Rating", "Defense Rating",
        "Endgame Parked", "Endgame Climbed", "Climb Type", "Notes"
    ]
    column_headers += [''] * (26 - len(column_headers))

    # Read the full sheet data with fixed range using Sheet2
    result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range='Sheet2!A1:Z1000').execute()
    all_values = result.get('values', [])

    # Find team header row
    team_row_index = None
    for i, row in enumerate(all_values):
        if len(row) > 0 and row[0] == f'Team {team}':
            team_row_index = i
            break

    if team_row_index is None:
        # Append new team section at bottom: empty row, team header, column headers, data row
        append_values = [empty_row, team_header, column_headers, data_row]

        sheet.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet2!A1:Z1000',  # Append range on Sheet2
            valueInputOption='RAW',
            insertDataOption='INSERT_ROWS',
            body={'values': append_values}
        ).execute()
    else:
        # Insert new data row under existing team section
        next_team_row_index = None
        for j in range(team_row_index + 1, len(all_values)):
            if len(all_values[j]) > 0 and all_values[j][0].startswith('Team '):
                next_team_row_index = j
                break

        insert_row_index = next_team_row_index if next_team_row_index is not None else len(all_values)

        # Insert blank row at insert_row_index to make space
        requests = [
            {
                "insertDimension": {
                    "range": {
                        "sheetId": 911578026,
                        "dimension": "ROWS",
                        "startIndex": insert_row_index,
                        "endIndex": insert_row_index + 1
                    },
                    "inheritFromBefore": False
                }
            }
        ]
        service.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": requests}).execute()

        # Update the inserted row with the data
        update_range = f'Sheet2!A{insert_row_index + 1}:Z{insert_row_index + 1}'

        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=update_range,
            valueInputOption='RAW',
            body={'values': [data_row]}
        ).execute()

    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
