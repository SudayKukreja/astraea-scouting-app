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

    # --- Extract base data ---
    name = data.get('name', '')
    team = str(data.get('team', ''))
    match_number = data.get('match_number', '')
    submitted_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # --- Extract nested info safely ---
    auto = data.get('auto', {})
    teleop = data.get('teleop', {})
    endgame = data.get('endgame', {})
    notes = data.get('notes', '')

    # --- Create summary strings ---
    auto_summary = (
        f"L1:{auto.get('l1', 0)}, L2:{auto.get('l2', 0)}, L3:{auto.get('l3', 0)}, "
        f"L4:{auto.get('l4', 0)}, P:{auto.get('processor', 0)}, B:{auto.get('barge', 0)}"
    )
    teleop_summary = (
        f"L1:{teleop.get('l1', 0)}, L2:{teleop.get('l2', 0)}, L3:{teleop.get('l3', 0)}, "
        f"L4:{teleop.get('l4', 0)}, P:{teleop.get('processor', 0)}, B:{teleop.get('barge', 0)}"
    )

    # --- Handle endgame summary robustly ---
    endgame_action = endgame.get('action', '').strip().lower()
    if endgame_action == 'climb':
        climb_depth = endgame.get('climb_depth', '').strip()
        if climb_depth:
            endgame_summary = f"Climb({climb_depth})"
        else:
            endgame_summary = "Climb"
    elif endgame_action == 'park':
        endgame_summary = "Park"
    else:
        endgame_summary = "None"

    # --- Compose the data row to insert ---
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

    # --- Clear and rebuild the entire sheet with proper formatting ---
    result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range='Sheet2!A1:Z1000').execute()
    all_values = result.get('values', [])
    
    # Group all data by team
    teams_data = {}
    for i, row in enumerate(all_values):
        if len(row) > 0:
            if row[0].startswith('Team '):
                # This is a team header, skip it
                continue
            elif row[0] == 'Scouter Name':
                # This is a column header, skip it
                continue
            elif row[0] == '':
                # Empty row, skip it
                continue
            else:
                # This is data - extract team number from second column
                if len(row) > 1:
                    team_num = str(row[1])
                    if team_num not in teams_data:
                        teams_data[team_num] = []
                    teams_data[team_num].append(row)
    
    # Add the new data
    if team not in teams_data:
        teams_data[team] = []
    teams_data[team].append(data_row)
    
    # Clear the sheet
    sheet.values().clear(spreadsheetId=SPREADSHEET_ID, range='Sheet2!A1:Z1000').execute()
    
    # Rebuild with proper formatting
    new_values = []
    format_requests = []
    current_row = 0
    
    for team_num in sorted(teams_data.keys(), key=int):
        team_name = TEAM_NAMES.get(team_num, "Unknown Team")
        
        # Add empty row (except for the first team)
        if current_row > 0:
            new_values.append([''] * 10)
            current_row += 1
        
        # Add team header
        team_header = [f'Team {team_num}: {team_name}'] + [''] * 9
        new_values.append(team_header)
        
        # Format team header as bold
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
        
        # Add column headers
        column_headers = [
            "Scouter Name", "Team Number", "Match Number", "Submission Time",
            "Auto Summary", "Teleop Summary", "Offense Rating", "Defense Rating",
            "Endgame Summary", "Notes"
        ]
        new_values.append(column_headers)
        current_row += 1
        
        # Sort data by match number and add all data for this team (no spaces between data rows)
        sorted_data = sorted(teams_data[team_num], key=lambda x: int(x[2]) if len(x) > 2 and str(x[2]).isdigit() else 0)
        for data_entry in sorted_data:
            new_values.append(data_entry)
            # Format data rows as non-bold
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
    
    # Write all data at once
    if new_values:
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'Sheet2!A1:J{len(new_values)}',
            valueInputOption='RAW',
            body={'values': new_values}
        ).execute()
    
    # Add left alignment for Match Number column (column C)
    if new_values:
        format_requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": 0,
                    "startColumnIndex": 2,  # Column C (0-indexed)
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
    
    # Apply formatting
    if format_requests:
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID, 
            body={"requests": format_requests}
        ).execute()

    return jsonify({'status': 'success'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)