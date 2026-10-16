from datetime import datetime

from flask import Blueprint, jsonify, send_file

from astraea.auth import admin_required
from astraea.services import scouting_data

bp = Blueprint('data', __name__, url_prefix='/api/admin')

XLSX_MIMETYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


@bp.route('/data/<kind>')
@admin_required
def get_table(kind):
    if kind not in scouting_data.FILES:
        return jsonify({'error': 'Unknown data type'}), 404
    return jsonify(scouting_data.table(kind))


@bp.route('/data/<kind>/<entry_id>', methods=['DELETE'])
@admin_required
def delete_entry(kind, entry_id):
    if kind not in scouting_data.FILES:
        return jsonify({'error': 'Unknown data type'}), 404
    if not scouting_data.delete_entry(kind, entry_id):
        return jsonify({'error': 'Entry not found'}), 404
    return jsonify({'success': True})


@bp.route('/export.xlsx')
@admin_required
def export_excel():
    filename = f"astraea-scouting-{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    return send_file(scouting_data.export_workbook(), as_attachment=True,
                     download_name=filename, mimetype=XLSX_MIMETYPE)
