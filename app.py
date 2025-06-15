from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

SERVICE_ACCOUNT_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '16nYGy_cVkEWtsRl64S5dlRn45wMLqSfFvHA8z7jjJc8'

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
service = build('sheets', 'v4', credentials=creds)
sheet = service.spreadsheets()

TEAM_NAMES = {
    "41": "RoboWarriors",
    "316": "LUNATECS",
    "341": "Miss Daisy",
    "365": "Miracle Workerz",
    "484": "Roboforce",
    "694": "Stuypulse",
    "694B": "Stuypulse second robot",
    "1218": "SCH Robotics",
    "1599": "CircuiTree",
    "1599B": "CircuiTree second robot",
    "1640": "Sab-BOT-age",
    "1908": "Shorebots",
    "1923": "The Midknight Inventors",
    "2016": "The Mighty Monkey Wrenches",
    "2377": "C-Company",
    "2495": "Hive Mind",
    "2539": "Krypton Cougars",
    "2539B": "Krypton Cougars second robot",
    "2607": "The Fighting Robovikings",
    "3136": "O.R.C.A.",
    "4099": "The Falcons",
    "4575": "GEMINI",
    "5113": "Combustible Lemons",
    "5113B": "Combustible Lemons second robot",
    "5338": "ACL RoboLoCo",
    "5338B": "ACL RoboLoCo second robot",
    "6897": "Astraea Robotics",
    "7414": "RetroRobotics",
    "7770": "Infinite Voltage",
    "9015": "Questionable Engineering",
    "10584": "Pennridge RoboRams",
    "69": "this is a funny easter egg"
}

@app.route('/', methods=['GET'])
def form():
    return render_template('index.html')

@app.route('/submit', methods=['POST'])
def submit():
    data = request.json

    name = data.get('name', '')
    team = str(data.get('team', ''))
    match_number = data.get('match_number', '')
    submitted_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    auto = data.get('auto', {})
    teleop = data.get('teleop', {})
    endgame = data.get('endgame', {})
    notes = data.get('notes', '')

    # New: get no_move flags, default False
    auto_no_move = auto.get('no_move', False)
    teleop_no_move = teleop.get('no_move', False)

    # Append no_move info to summaries for clarity
    auto_summary = (
        f"L1:{auto.get('l1', 0)}, L2:{auto.get('l2', 0)}, L3:{auto.get('l3', 0)}, "
        f"L4:{auto.get('l4', 0)}, P:{auto.get('processor', 0)}, B:{auto.get('barge', 0)}, "
        f"No Move:{'Yes' if auto_no_move else 'No'}"
    )
    teleop_summary = (
        f"L1:{teleop.get('l1', 0)}, L2:{teleop.get('l2', 0)}, L3:{teleop.get('l3', 0)}, "
        f"L4:{teleop.get('l4', 0)}, P:{teleop.get('processor', 0)}, B:{teleop.get('barge', 0)}, "
        f"No Move:{'Yes' if teleop_no_move else 'No'}"
    )

    endgame_action = endgame.get('action', '').strip().lower()
    if endgame_action == 'climb':
        climb_depth = endgame.get('climb_depth', '').strip()
        if climb_depth:
            endgame_summary = f"Climb({climb_depth})"
        else:
            endgame_summary = "Climb"
    elif endgame_action == 'park':
        endgame_summary = "Park"
    elif endgame_action == 'did not park/climb':
        endgame_summary = "Did Not Park/Climb"
    else:
        endgame_summary = "None"

    data_row = [
        name,
        team,
        match_number,
        submitted_time,
        auto_summary,
        teleop_summary,
        teleop.get('offense_rating', 0),
        teleop.get('defense_rating', 0),
        endgame_summary,
        notes
    ]

    result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range='Sheet2!A1:Z1000').execute()
    all_values = result.get('values', [])
    
    teams_data = {}
    for i, row in enumerate(all_values):
        if len(row) > 0:
            if row[0].startswith('Team '):
                continue
            elif row[0] == 'Scouter Name':
                continue
            elif row[0] == '':
                continue
            else:
                if len(row) > 1:
                    team_num = str(row[1])
                    if team_num not in teams_data:
                        teams_data[team_num] = []
                    teams_data[team_num].append(row)
    
    if team not in teams_data:
        teams_data[team] = []
    teams_data[team].append(data_row)
    
    sheet.values().clear(spreadsheetId=SPREADSHEET_ID, range='Sheet2!A1:Z1000').execute()
    
    new_values = []
    format_requests = []
    current_row = 0
    
    for team_num in sorted(teams_data.keys(), key=int):
        team_name = TEAM_NAMES.get(team_num, "Unknown Team")
        
        if current_row > 0:
            new_values.append([''] * 10)
            current_row += 1
        
        team_header = [f'Team {team_num}: {team_name}'] + [''] * 9
        new_values.append(team_header)
        
        format_requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": 0,
                    "startRowIndex": current_row,
                    "endRowIndex": current_row + 1
                },
                "cell": {"userEnteredFormat": {"textFormat": {"bold": True}}},
                "fields": "userEnteredFormat.textFormat.bold"
            }
        })
        current_row += 1
        
        column_headers = [
            "Scouter Name", "Team Number", "Match Number", "Submission Time",
            "Auto Summary", "Teleop Summary", "Offense Rating", "Defense Rating",
            "Endgame Summary", "Notes"
        ]
        new_values.append(column_headers)
        current_row += 1
        
        sorted_data = sorted(teams_data[team_num], key=lambda x: int(x[2]) if len(x) > 2 and str(x[2]).isdigit() else 0)
        for data_entry in sorted_data:
            new_values.append(data_entry)
            format_requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": current_row,
                        "endRowIndex": current_row + 1
                    },
                    "cell": {"userEnteredFormat": {"textFormat": {"bold": False}}},
                    "fields": "userEnteredFormat.textFormat.bold"
                }
            })
            current_row += 1
    
    if new_values:
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'Sheet2!A1:J{len(new_values)}',
            valueInputOption='RAW',
            body={'values': new_values}
        ).execute()
    
    if new_values:
        format_requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": 0,
                    "startColumnIndex": 2,
                    "endColumnIndex": 3,
                    "startRowIndex": 0,
                    "endRowIndex": len(new_values)
                },
                "cell": {
                    "userEnteredFormat": {
                        "horizontalAlignment": "LEFT"
                    }
                },
                "fields": "userEnteredFormat.horizontalAlignment"
            }
        })
    
    if format_requests:
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID, 
            body={"requests": format_requests}
        ).execute()

    return jsonify({'status': 'success'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)