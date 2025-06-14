from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1FN0yuBTIiUTbzGpVxh0UG_l6YYhtbHlxfNxuNgUkE10'

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
service = build('sheets', 'v4', credentials=creds)

spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()

print("Sheet names in the spreadsheet:")
for sheet_info in spreadsheet.get('sheets', []):
    print(sheet_info['properties']['title'])
