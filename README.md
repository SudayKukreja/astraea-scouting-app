# Astraea Scouting

Match and pit scouting app for FRC Team 6897.

## Running locally

```
pip install -r requirements.txt
python app.py
```

## Environment variables

| Variable      | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `SECRET_KEY`  | Flask session secret                                           |
| `TBA_API_KEY` | The Blue Alliance API key for loading event schedules          |
| `DATA_DIR`    | Folder for stored data (default `data/`). Point this at a persistent disk in production. |

## Layout

```
app.py                  entry point
astraea/
  __init__.py           app factory
  auth.py               login + role decorators
  storage.py            locked JSON file storage
  routes/               pages, scouting, admin, data (spreadsheet + Excel export)
  services/             assignments, events (TBA + manual), scouting_data
  reference/            team names and scouter roster
  templates/
  static/css, js, img
scripts/deploy.ps1      bumps the service worker cache and pushes
data/                   runtime data (git-ignored)
```

## Scouting data

Submissions are saved to `scouting_data.json` and `pit_data.json` in `DATA_DIR`.
Admins can browse, search, sort, and delete entries under **Scouting Data**, and
download everything as an `.xlsx` workbook with **Download Excel**.
