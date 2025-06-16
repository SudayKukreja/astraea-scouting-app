from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timezone, timedelta
import os
from uuid import uuid4

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
    "1218": "SCH Robotics",
    "1599": "CircuiTree",
    "1640": "Sab-BOT-age",
    "1908": "Shorebots",
    "1923": "The Midknight Inventors",
    "2016": "The Mighty Monkey Wrenches",
    "2377": "C-Company",
    "2495": "Hive Mind",
    "2539": "Krypton Cougars",
    "2607": "The Fighting Robovikings",
    "3136": "O.R.C.A.",
    "4099": "The Falcons",
    "4575": "GEMINI",
    "5113": "Combustible Lemons",
    "5338": "ACL RoboLoCo",
    "6897": "Astraea Robotics",
    "7414": "RetroRobotics",
    "7770": "Infinite Voltage",
    "9015": "Questionable Engineering",
    "10584": "Pennridge RoboRams",
}

@app.route('/', methods=['GET'])
def form():
    return render_template('index.html')

@app.route('/submit', methods=['POST'])
def submit():
    data = request.json

    name = data.get('name', '').strip()
    team = str(data.get('team', '')).strip()
    match_number = data.get('match', '').strip()
    est = timezone(timedelta(hours=-4))
    now = datetime.now(est)
    timestamp_us = now.isoformat(timespec='microseconds')
    unique_suffix = uuid4().hex[:8]
    submitted_time = f"{timestamp_us}_{unique_suffix}"

    auto = data.get('auto', {})
    teleop = data.get('teleop', {})
    endgame = data.get('endgame', {})
    notes = data.get('notes', '').strip()

    # Use 'mainly_play_style' from frontend
    focus = data.get('mainly_play_style', '').strip().lower()

    auto_no_move = auto.get('no_move', False)
    teleop_no_move = teleop.get('no_move', False)

    auto_summary = (
        f"L1:{auto.get('ll1', 0)}, L2:{auto.get('l2', 0)}, L3:{auto.get('l3', 0)}, "
        f"L4:{auto.get('l4', 0)}, P:{auto.get('processor', 0)}, B:{auto.get('barge', 0)}, "
        f"No Move:{'Yes' if auto_no_move else 'No'}"
    )

    teleop_counts = (
        f"L1:{teleop.get('ll1', 0)}, L2:{teleop.get('l2', 0)}, L3:{teleop.get('l3', 0)}, "
        f"L4:{teleop.get('l4', 0)}, P:{teleop.get('processor', 0)}, B:{teleop.get('barge', 0)}, "
        f"No Move:{'Yes' if teleop_no_move else 'No'}"
    )

    def clean_rating(val):
        try:
            val_num = int(val)
            return str(val_num) if val_num > 0 else '-'
        except:
            return '-' if val is None or val == '' else str(val)

    if focus == 'defense':
        teleop_summary = f"{teleop_counts}, Playstyle: Defense"
        offense_rating = '-'
        defense_rating = clean_rating(teleop.get('defense_rating', '-'))
    elif focus == 'offense':
        teleop_summary = f"{teleop_counts}, Playstyle: Offense"
        offense_rating = clean_rating(teleop.get('offense_rating', '-'))
        defense_rating = '-'
    elif focus == 'both':
        teleop_summary = f"{teleop_counts}, Playstyle: Both"
        offense_rating = clean_rating(teleop.get('offense_rating', '-'))
        defense_rating = clean_rating(teleop.get('defense_rating', '-'))
    else:
        # Default fallback to Both
        teleop_summary = f"{teleop_counts}, Playstyle: Both"
        offense_rating = clean_rating(teleop.get('offense_rating', '-'))
        defense_rating = clean_rating(teleop.get('defense_rating', '-'))

    print("FOCUS value received:", repr(focus))

    endgame_action = endgame.get('action', '').strip().lower()
    if endgame_action == 'climb':
        climb_depth = endgame.get('climb_depth', '').strip()
        endgame_summary = f"Climb({climb_depth})" if climb_depth else "Climb"
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
        offense_rating,
        defense_rating,
        endgame_summary,
        notes
    ]

    # Fetch existing data
    result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range='Duel on the Delaware!A1:Z1000').execute()
    all_values = result.get('values', [])

    teams_data = {}
    for row in all_values:
        if len(row) > 0 and not row[0].startswith('Team ') and row[0] != 'Scouter Name':
            team_num = str(row[1]) if len(row) > 1 else ''
            if team_num not in teams_data:
                teams_data[team_num] = []
            teams_data[team_num].append(row)

    if team not in teams_data:
        teams_data[team] = []
    teams_data[team].append(data_row)

    # Clear existing content
    sheet.values().clear(spreadsheetId=SPREADSHEET_ID, range='Duel on the Delaware!A1:Z1000').execute()

    new_values = []
    format_requests = []
    current_row = 0

    for team_num in sorted(teams_data.keys(), key=int):
        team_name = TEAM_NAMES.get(team_num, "Unknown Team")

        if current_row > 0:
            new_values.append([''] * 10)
            current_row += 1

        new_values.append([f'Team {team_num}: {team_name}'] + [''] * 9)
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

        new_values.append([
            "Scouter Name", "Team Number", "Match Number", "Submission Time",
            "Auto Summary", "Teleop Summary", "Offense Rating", "Defense Rating",
            "Endgame Summary", "Notes"
        ])
        current_row += 1

        sorted_data = sorted(
            teams_data[team_num],
            key=lambda x: int(x[2]) if len(x) > 2 and str(x[2]).isdigit() else 0
        )
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
            range=f'Duel on the Delaware!A1:J{len(new_values)}',
            valueInputOption='RAW',
            body={'values': new_values}
        ).execute()

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
