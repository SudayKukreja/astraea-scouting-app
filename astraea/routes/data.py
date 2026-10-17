from datetime import datetime

from flask import Blueprint, jsonify, request, send_file

from astraea.services import scouting_data
from astraea.services.scouting_data import ValidationError

bp = Blueprint('data', __name__, url_prefix='/api')

XLSX_MIMETYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


def _check_kind(kind):
    if kind not in scouting_data.FILES:
        return jsonify({'error': 'Unknown data type'}), 404
    return None


@bp.route('/entries/<kind>')
def get_table(kind):
    return _check_kind(kind) or jsonify(scouting_data.table(kind))


@bp.route('/entries/<kind>', methods=['POST'])
@bp.route('/entries/<kind>/<entry_id>', methods=['PUT'])
def save_entry(kind, entry_id=None):
    if error := _check_kind(kind):
        return error
    data = request.json or {}
    try:
        cleaned = scouting_data.CLEANERS[kind](data)
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400

    duplicate = scouting_data.find_duplicate(kind, cleaned, exclude_id=entry_id)
    if duplicate and not data.get('force'):
        what = f"match {cleaned['match']}" if kind == 'match' else 'this event'
        return jsonify({'duplicate': True,
                        'error': f"Team {cleaned['team']} already has an entry for {what}. Save anyway?"}), 409

    entry = scouting_data.save_entry(kind, data, entry_id)
    if entry is None:
        return jsonify({'error': 'Entry not found'}), 404
    return jsonify({'success': True, 'entry': entry})


@bp.route('/entries/<kind>/<entry_id>', methods=['DELETE'])
def delete_entry(kind, entry_id):
    if error := _check_kind(kind):
        return error
    if not scouting_data.delete_entry(kind, entry_id):
        return jsonify({'error': 'Entry not found'}), 404
    return jsonify({'success': True})


@bp.route('/export.xlsx')
def export_excel():
    filename = f"astraea-scouting-{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    return send_file(scouting_data.export_workbook(), as_attachment=True,
                     download_name=filename, mimetype=XLSX_MIMETYPE)
