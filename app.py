from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import os, json

app = Flask(__name__)
CORS(app)

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '16nYGy_cVkEWtsRl64S5dlRn45wMLqSfFvHA8z7jjJc8'

credentials_info = json.loads(os.environ['GOOGLE_CREDENTIALS'])
creds = service_account.Credentials.from_service_account_info(credentials_info, scopes=SCOPES)
service = build('sheets', 'v4', credentials=creds)
sheet = service.spreadsheets()

TEAM_NAMES = {
    "11": "MORT",
    "25": "Raider Robotix",
    "41": "RoboWarriors",
    "56": "R.O.B.B.E.",
    "75": "RoboRaiders",
    "87": "Diablo",
    "102": "The Gearheads",
    "103": "Cybersonics",
    "1168": "Malvern Robotics",
    "1218": "SCH Robotics",
    "1257": "Parallel Universe",
    "1279": "Cold Fusion",
    "1391": "The Metal Moose",
    "1403": "Team 1403 Cougar Robotics",
    "1626": "Falcon Robotics",
    "1640": "Sab-BOT-age",
    "1647": "Iron Devils",
    "1672": "Robo T-Birds",
    "1676": "The Pascack PI-oneers",
    "1712": "Dawgma",
    "1807": "Redbird Robotics",
    "1811": "FRESH",
    "1923": "The MidKnight Inventors",
    "193": "MORT Beta",
    "2016": "Mighty Monkey Wrenches",
    "203": "SOUPERBOTS",
    "204": "Eastern Robotic Vikings",
    "2180": "Zero Gravity",
    "219": "Team Impact",
    "2191": "Flux Core",
    "222": "Tigertrons",
    "223": "Xtreme Heat",
    "2234": "Alternating Current",
    "2458": "Team Chaos",
    "2495": "Hive Mind",
    "2539": "Krypton Cougars",
    "2554": "The Warhawks",
    "2559": "Normality Zero",
    "2577": "Pingry Robotics",
    "2590": "Nemesis",
    "2607": "The Fighting RoboVikings",
    "2637": "N/A",  # not in your list but if needed, can add later
    "272": "Cyber Crusaders",
    "2720": "Red Watch Robotics",
    "2722": "Charge Robotics",
    "293": "SPIKE",
    "303": "The T.E.S.T. Team",
    "3142": "Aperture",
    "316": "LUNATECS",
    "321": "RoboLancers",
    "3340": "Union City MagneGeeks",
    "3314": "Mechanical Mustangs",
    "3340": "Union City MagneGeeks",
    "3637": "The Daleks",
    "365": "Miracle Workerz",
    "4039": "N/A",
    "4099": "The Falcons",
    "423": "Simple Machines",
    "427": "LANCE-A-LOT",
    "428": "BoroBlasters",
    "430": "MORT GAMMA",
    "433": "Firebirds",
    "4342": "Demon Robotics",
    "4361": "Roxbotix",
    "4373": "RooBotics",
    "4573": "Rambotics",
    "4575": "Gemini",
    "4637": "BambieBotz",
    "4652": "Ironmen 2",
    "4653": "Ironmen Robotics",
    "4750": "Bert",
    "484": "Roboforce",
    "486": "Positronic Panthers",
    "5113": "Combustible Lemons",
    "5181": "Explorer Robotics",
    "5310": "Mecha Ravens",
    "5401": "Fightin' Robotic Owls",
    "5407": "Wolfpack Robotics",
    "5438": "Technological Terrors",
    "5490": "The Dark Byte",
    "5566": "N/A",
    "5624": "TIGER TECH Robotics",
    "5666": "Purple Lightning",
    "5684": "Titans of Tech - Thrive Charter School",
    "5732": "ROBOTIGERS",
    "5895": "Peddie Robotics",
    "5992": "Pirates",
    "6016": "Tiger Robotics",
    "6226": "Blue Devils",
    "6808": "William Tennent Robotics",
    "6860": "Equitum Robotics",
    "6897": "Astraea Robotics",
    "6921": "Technados",
    "6945": "Children of the Corn",
    "7045": "MCCrusaders",
    "708": "Hatters Robotics",
    "709": "Femme Tech Fatale",
    "7110": "Heights Bytes",
    "714": "Panthera",
    "7414": "RetroRobotics",
    "752": "Chargers",
    "7587": "Metuchen Momentum",
    "8075": "CyberTigers",
    "8117": "The Easton RoboRovers",
    "8130": "Absegami Robotics",
    "834": "SparTechs",
    "8588": "Tech Devils",
    "8628": "Newark School of Global Studies",
    "8630": "CAP ROBOTICS",
    "8704": "Void Warranty",
    "8706": "MXS Bulldog Bots",
    "8707": "The Newark Circuit Breakers",
    "8714": "Robo Griffins'",
    "8721": "M.I.T.",
    "8771": "PioTech",
    "9014": "Vulcan Mechanics",
    "9015": "Questionable Engineering",
    "9027": "PATH to Domination",
    "9060": "N/A",
    "9094": "The Earthquakers",
    "9100": "Robo Roses",
    "9116": "The Canucks & Bolts",
    "9416": "International Θperatives of World Affairs",
    "9424": "E.O. JAG BOTS",
    "9439": "Knights of Polaris",
    "10001": "Belt 2 Bot",
    "10069": "University Academic Charter School",
    "10070": "Ghost Bots",
    "10143": "Northeast High School Philadelphia Robotics Team",
    "10157": "Roman Robotics",
    "10170": "ND Robotics",
    "10232": "Killer Kardinals 2",
    "10366": "Builder Bears",
    "10400": "DART Doane Academy Robotics Team",
    "10480": "CyberStorm",
    "10584": "Pennridge RoboRams",
    "10600": "Two Steps Ahead",
    "10653": "Reybotics",
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

    auto_no_move = auto.get('no_move', False)
    teleop_no_move = teleop.get('no_move', False)
    partial_match = data.get('partial_match', False)  # fix: get from root 'partial_match'

    # Remove "No Move" from summaries:
    auto_summary = (
        f"L1:{auto.get('ll1', 0)}, L2:{auto.get('l2', 0)}, L3:{auto.get('l3', 0)}, "
        f"L4:{auto.get('l4', 0)}, P:{auto.get('processor', 0)}, B:{auto.get('barge', 0)}"
    )

    dropped_pieces = teleop.get('dropped_pieces', 0)
    teleop_summary = (
        f"L1:{teleop.get('ll1', 0)}, L2:{teleop.get('l2', 0)}, L3:{teleop.get('l3', 0)}, "
        f"L4:{teleop.get('l4', 0)}, P:{teleop.get('processor', 0)}, B:{teleop.get('barge', 0)}, "
        f"Dropped:{dropped_pieces}"
    )

    def clean_rating(val):
        try:
            val_num = int(val)
            return str(val_num) if val_num > 0 else '-'
        except:
            return '-' if val is None or val == '' else str(val)

    offense_rating = clean_rating(teleop.get('offense_rating', '-'))
    defense_rating = clean_rating(teleop.get('defense_rating', '-'))

    endgame_action = endgame.get('action', '').strip().lower()
    if endgame_action == 'climb':
        climb_depth = endgame.get('climb_depth', '').strip()
        endgame_summary = f"Climb({climb_depth})" if climb_depth else "Climb"
    elif endgame_action == 'park':
        endgame_summary = "Park"
    elif endgame_action == 'did not park/climb':
        endgame_summary = "Did Not Park/Climb"
    else:
        endgame_summary = "None".\deploy.ps1

    # Mobility summary includes no move flags and partial match
    mobility_parts = []
    if auto_no_move:
        mobility_parts.append("No Auto Move")
    if teleop_no_move:
        mobility_parts.append("No Teleop Move")
    if partial_match:
        mobility_parts.append("Partial Match Shutdown")

    mobility_summary = ", ".join(mobility_parts) if mobility_parts else "Moved"

    data_row = [
        name, team, match_number, submitted_time, auto_summary,
        teleop_summary, offense_rating, defense_rating,
        endgame_summary, mobility_summary, notes
    ]

    result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range='Testing!A1:Z1000').execute()
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

    sheet.values().clear(spreadsheetId=SPREADSHEET_ID, range='Testing!A1:Z1000').execute()

    new_values = []
    format_requests = []
    current_row = 0

    for team_num in sorted(teams_data.keys(), key=int):
        team_name = TEAM_NAMES.get(team_num, "Unknown Team")

        if current_row > 0:
            new_values.append([''] * 11)  # 11 columns total now
            current_row += 1

        # Team header row (bold + bigger font size)
        new_values.append([f'Team {team_num}: {team_name}'] + [''] * 10)
        format_requests.append({
            "repeatCell": {
                "range": {"sheetId": 305140406, "startRowIndex": current_row, "endRowIndex": current_row + 1},
                "cell": {"userEnteredFormat": {"textFormat": {"bold": True, "fontSize": 14}}},
                "fields": "userEnteredFormat.textFormat"
            }
        })
        current_row += 1

        # Column headers row
        new_values.append([
            "Scouter Name", "Team Number", "Match Number", "Submission Time",
            "Auto Summary", "Teleop Summary", "Offense Rating", "Defense Rating",
            "Endgame Summary", "Mobility", "Notes"
        ])
        # Make headers bold, normal font size
        format_requests.append({
            "repeatCell": {
                "range": {"sheetId": 305140406, "startRowIndex": current_row, "endRowIndex": current_row + 1},
                "cell": {"userEnteredFormat": {"textFormat": {"bold": True}}},
                "fields": "userEnteredFormat.textFormat"
            }
        })
        current_row += 1

        # Add sorted data rows
        sorted_data = sorted(teams_data[team_num], key=lambda x: int(x[2]) if len(x) > 2 and str(x[2]).isdigit() else 0)
        for entry in sorted_data:
            new_values.append(entry)
            # Make data rows normal font, no bold
            format_requests.append({
                "repeatCell": {
                    "range": {"sheetId": 305140406, "startRowIndex": current_row, "endRowIndex": current_row + 1},
                    "cell": {"userEnteredFormat": {"textFormat": {"bold": False}}},
                    "fields": "userEnteredFormat.textFormat"
                }
            })
            current_row += 1

    if new_values:
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'Testing!A1:K{len(new_values)}',
            valueInputOption='RAW',
            body={'values': new_values}
        ).execute()

    if format_requests:
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={"requests": format_requests}
        ).execute()

    return jsonify({'status': 'success'})


@app.route('/sw.js')
def serve_sw():
    return send_from_directory('.', 'sw.js', mimetype='application/javascript')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
