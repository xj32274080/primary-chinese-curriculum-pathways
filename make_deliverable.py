# -*- coding: utf-8 -*-
import hashlib
import json
import os
import re

def main():
    # 1. Verify baseline hash
    root = os.path.dirname(os.path.abspath(__file__))
    baseline_path = os.path.join(root, '课标统领的教材脉络图_单元要素版.html')
    with open(baseline_path, 'rb') as f:
        baseline_bytes = f.read()

    h = hashlib.sha256(baseline_bytes).hexdigest()
    assert h == '8d4da60e81c1db566491729a46a97c4f43c46a1397871a41914d3908352a21e0', f'Baseline hash mismatch: {h}'
    print('Baseline SHA-256 hash verified: 8d4da60e81c1db566491729a46a97c4f43c46a1397871a41914d3908352a21e0')

    baseline_text = baseline_bytes.decode('utf-8')
    full_match = re.search(r'^const FULL\s*=\s*\{[^\r\n]*\};', baseline_text, re.M)
    assert full_match, 'Could not find the stable volume-name mapping in baseline'

    data_path = os.path.join(root, '续作交接_2026-10-06', 'curriculum_data.json')
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    unit_count = len(data['units'])
    element_count = sum(len(u['elements']) for u in data['units'].values())
    if unit_count != 94 or element_count != 155:
        raise ValueError(f'Core textbook data changed unexpectedly: {unit_count} units, {element_count} elements')
    element_ids = {e['eid'] for u in data['units'].values() for e in u['elements']}
    unknown_links = sorted(set(data.get('links', {})) - element_ids)
    if unknown_links:
        raise ValueError(f'Links refer to unknown elements: {unknown_links[:5]}')
    comparison = data.get('strategyComparison')
    if comparison:
        elements = {e['eid']: e for u in data['units'].values() for e in u['elements']}
        rows = comparison['rows']
        if len(rows) != 6 or len({row['eid'] for row in rows}) != 6:
            raise ValueError('Reading method comparison must contain six distinct elements')
        for row in rows:
            if row['eid'] not in elements or row['text'] != elements[row['eid']]['text']:
                raise ValueError(f"Reading strategy original differs from maintained element: {row['eid']}")
        method_ids = {row['eid'] for row in rows}
        for eid, support in data.get('methodSupportMap', {}).items():
            if eid not in element_ids or not support['methodEids'] or not set(support['methodEids']) <= method_ids:
                raise ValueError(f'Unknown element in method support: {eid}')
    same_relations = data.get('sameUnitRelations', [])
    seen_relation_ids = set()
    for relation in same_relations:
        rid = relation.get('id')
        if not rid or rid in seen_relation_ids:
            raise ValueError(f'Invalid or duplicate same-unit relation id: {rid}')
        seen_relation_ids.add(rid)
        if relation.get('from') not in element_ids or relation.get('to') not in element_ids or relation.get('from') == relation.get('to'):
            raise ValueError(f'Same-unit relation endpoints are invalid: {rid}')
        if not relation.get('relationType') or not relation.get('summary') or not relation.get('boundary'):
            raise ValueError(f'Same-unit relation lacks summary/boundary: {rid}')
        source = relation.get('source') or {}
        for key in ('title', 'file', 'printPage', 'pdfPage', 'quote'):
            if not source.get(key):
                raise ValueError(f'Same-unit relation source lacks {key}: {rid}')
    if same_relations:
        print(f'Validated same-unit relation records: {len(same_relations)}')
    theme_clusters = data.get('humanThemeClusters', [])
    seen_theme_ids = set()
    for cluster in theme_clusters:
        cid = cluster.get('id')
        if not cid or cid in seen_theme_ids or not cluster.get('label') or not cluster.get('boundary'):
            raise ValueError(f'Invalid or duplicate human-theme cluster: {cid}')
        seen_theme_ids.add(cid)
        seen_units = set()
        for item in cluster.get('units', []):
            uid = item.get('unitId')
            source = item.get('source') or {}
            if uid in seen_units or uid not in data['units'] or not data['units'][uid].get('theme'):
                raise ValueError(f'Invalid or duplicate unit in human-theme cluster {cid}: {uid}')
            seen_units.add(uid)
            if not item.get('reason') or any(not source.get(key) for key in ('type', 'title', 'file', 'printPage', 'pdfPage')):
                raise ValueError(f'Human-theme item lacks reason or source fields: {cid}/{uid}')
        if len(seen_units) < 2:
            raise ValueError(f'Human-theme cluster must contain at least two units: {cid}')
    if theme_clusters:
        print(f'Validated human-theme cluster records: {len(theme_clusters)} ({sum(len(c.get("units", [])) for c in theme_clusters)} units)')
    data_block = full_match.group(0) + '\nconst D = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    print(f'Loaded maintained data source: {data_path} ({unit_count} units, {element_count} elements)')

    # Read our modular components
    with open(os.path.join(root, 'styles.css'), 'r', encoding='utf-8') as f:
        styles = f.read()

    with open(os.path.join(root, 'logic.js'), 'r', encoding='utf-8') as f:
        logic = f.read()

    html_content = f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>课标统领的教材脉络图 · 导出版</title>
<style>
{styles}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="t1">课标统领的教材脉络图 · 导出版</div>
    <div class="t2" id="sub"></div>
    <div class="tools" id="tools"></div>
  </div>
  <div id="table"></div>
  <div id="detail"></div>
  <div class="foot" id="foot"></div>
</div>
<div id="print-view"></div>
<script>
{data_block}
{logic}
</script>
</body>
</html>
'''

    out_path = os.path.join(root, '课标统领的教材脉络图_导出版.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f'Successfully built {out_path}, total size: {len(html_content)} chars')

if __name__ == '__main__':
    main()
