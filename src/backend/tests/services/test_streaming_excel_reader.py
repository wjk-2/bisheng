# src/backend/tests/services/test_streaming_excel_reader.py
import os
import sys
import importlib.util
import pytest
import zipfile
import tempfile


def _load_reader():
    """直接加载模块文件，绕过 bisheng/__init__.py 触发的重量级依赖。"""
    _base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    _module_path = os.path.join(_base, "bisheng", "api", "services", "streaming_excel_reader.py")
    spec = importlib.util.spec_from_file_location("streaming_excel_reader", _module_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

SHARED_STRINGS_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">
<si><t>姓名</t></si>
<si><t>张三</t></si>
<si><t>李四</t></si>
</sst>'''

SHEET1_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>10</v></c></row>
<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>20</v></c></row>
<row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>30</v></c></row>
</sheetData>
</worksheet>'''

WORKBOOK_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Sheet1" sheetId="1" r:id="rId1"/>
</sheets>
</workbook>'''

WORKBOOK_RELS_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>'''

STYLES_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="0"/>
<cellXfs count="1"><xf numFmtId="0" xfId="0"/></cellXfs>
</styleSheet>'''

CONTENT_TYPES_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>'''


def make_test_xlsx(tmp_path, sheet_xml=SHEET1_XML, with_shared_strings=True):
    xlsx_path = os.path.join(tmp_path, "test.xlsx")
    with zipfile.ZipFile(xlsx_path, "w") as zf:
        zf.writestr("[Content_Types].xml", CONTENT_TYPES_XML)
        zf.writestr("xl/workbook.xml", WORKBOOK_XML)
        zf.writestr("xl/_rels/workbook.xml.rels", WORKBOOK_RELS_XML)
        zf.writestr("xl/styles.xml", STYLES_XML)
        if with_shared_strings:
            zf.writestr("xl/sharedStrings.xml", SHARED_STRINGS_XML)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return xlsx_path


def test_basic_read():
    read_xlsx_streaming = _load_reader().read_xlsx_streaming
    with tempfile.TemporaryDirectory() as tmp:
        xlsx_path = make_test_xlsx(tmp)
        result = read_xlsx_streaming(xlsx_path)
    assert len(result) == 1
    sheet_name, data_grid = result[0]
    assert sheet_name == "Sheet1"
    assert data_grid[0][0] == "姓名"
    assert data_grid[1][0] == "张三"
    assert data_grid[2][0] == "李四"
    assert data_grid[0][1] == 10
    assert data_grid[1][1] == 20


def test_no_shared_strings():
    """纯数字文件，没有 sharedStrings.xml"""
    read_xlsx_streaming = _load_reader().read_xlsx_streaming
    sheet_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1"><v>100</v></c><c r="B1"><v>200</v></c></row>
</sheetData>
</worksheet>'''
    with tempfile.TemporaryDirectory() as tmp:
        xlsx_path = make_test_xlsx(tmp, sheet_xml=sheet_xml, with_shared_strings=False)
        result = read_xlsx_streaming(xlsx_path)
    assert len(result) == 1
    _, grid = result[0]
    assert grid[0][0] == 100
    assert grid[0][1] == 200


def test_merged_cells():
    """合并单元格，顶左值应填充到整个范围"""
    read_xlsx_streaming = _load_reader().read_xlsx_streaming
    sheet_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="2"><c r="A2"><v>1</v></c></row>
</sheetData>
<mergeCells count="1">
<mergeCell ref="A1:B1"/>
</mergeCells>
</worksheet>'''
    with tempfile.TemporaryDirectory() as tmp:
        xlsx_path = make_test_xlsx(tmp, sheet_xml=sheet_xml)
        result = read_xlsx_streaming(xlsx_path)
    _, grid = result[0]
    assert grid[0][0] == "姓名"
    assert grid[0][1] == "姓名"


def test_empty_rows_stop():
    """连续 50 个空行后应提前退出，不读取后续数据"""
    read_xlsx_streaming = _load_reader().read_xlsx_streaming
    rows_xml = '<row r="1"><c r="A1"><v>999</v></c></row>\n'
    for i in range(2, 53):
        rows_xml += f'<row r="{i}"></row>\n'
    rows_xml += '<row r="53"><c r="A53"><v>888</v></c></row>\n'

    sheet_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>{rows_xml}</sheetData>
</worksheet>'''
    with tempfile.TemporaryDirectory() as tmp:
        xlsx_path = make_test_xlsx(tmp, sheet_xml=sheet_xml, with_shared_strings=False)
        result = read_xlsx_streaming(xlsx_path)
    _, grid = result[0]
    assert grid[0][0] == 999
    all_vals = [cell for row in grid for cell in row if cell is not None]
    assert 888 not in all_vals


def test_bad_zip():
    """损坏文件应返回空列表，不抛异常"""
    read_xlsx_streaming = _load_reader().read_xlsx_streaming
    with tempfile.TemporaryDirectory() as tmp:
        bad_path = os.path.join(tmp, "bad.xlsx")
        with open(bad_path, "wb") as f:
            f.write(b"this is not a zip file")
        result = read_xlsx_streaming(bad_path)
    assert result == []
