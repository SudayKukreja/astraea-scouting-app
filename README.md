# Astraea Scouting

Data entry and analytics for FRC Team 6897's paper scouting. Runs on one Mac, fully offline.

## Start

Double-click **Start Astraea Scouting.command** (first run needs internet to install packages),
or from Terminal:

```
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python app.py
```

Then open http://localhost:5001.

## Configuration (`.env`, optional)

| Variable      | Purpose                                                           |
| ------------- | ----------------------------------------------------------------- |
| `TBA_API_KEY` | The Blue Alliance key, needed only to load event schedules        |
| `PORT`        | Port to run on (default `5001`; macOS uses 5000 for AirPlay)      |
| `DATA_DIR`    | Where data is stored (default `data/`)                            |
| `APP_PASSWORD`| If set, the browser asks for this password (required on Render)   |

## Pages

- **Enter Data / Pit Data**: copy paper sheets in; Save & Next keeps scouter, event and match
- **Data**: search, sort, edit, delete, and **Download Excel**
- **Rankings, Compare, Match Lookup**: analytics from entered data
- **Events**: load schedules from TBA or create them manually; saved for offline use

## Layout

```
app.py                  entry point
astraea/
  routes/               pages, data API, events, analytics
  services/             scouting_data, analytics, events, tba
  reference/            team names
  templates/  static/
data/                   your scouting data (back this folder up)
```
