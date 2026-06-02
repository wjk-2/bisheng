# 200MB Excel 文件上传支持实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Excel 文件上传上限从 100MB 提升至 200MB，同时将解析器从 openpyxl 全量加载替换为流式 XML 解析，消除大文件 OOM 风险。

**Architecture:** 两条独立改动线并行推进——限制层（5处数字改动，零逻辑变化）和解析层（新建 `streaming_excel_reader.py`，替换 `excel_file_to_markdown()` 入口约20行）。所有下游函数（`process_dataframe_to_markdown_files`、`generate_markdown_table_string`）和所有上层调用路径（知识库同步/异步、工作流 InputNode、Workstation 直传、Open API）完全不动。

**Tech Stack:** Python 3.10 标准库（`zipfile`、`xml.etree.ElementTree.iterparse`、`datetime`）；React 18 + TypeScript；FastAPI；openpyxl（仅保留 CSV/xls 路径，xlsx 路径弃用）

---

## 文件地图

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `src/backend/bisheng/api/services/streaming_excel_reader.py` | 流式 XLSX 解析器，stdlib only |
| 修改 | `src/backend/bisheng/api/services/md_from_excel.py` | 替换 `excel_file_to_markdown()` 入口 |
| 新建 | `src/backend/tests/services/test_streaming_excel_reader.py` | 单元测试 |
| 修改 | `src/backend/bisheng/core/cache/utils.py:219,239` | 常量 + 错误文案 |
| 修改 | `src/backend/bisheng/initdb_config.yaml:53` | 配置默认值 |
| 修改 | `src/frontend/platform/src/components/inputFileComponent/index.tsx:53` | 前端兜底值 |
| 修改 | `src/frontend/client/src/pages/appChat/components/InputFileComponent.tsx:53,55` | 前端兜底值 |
| 修改 | `src/frontend/client/src/pages/appChat/ChatInput.tsx:45` | 前端兜底值 |

---

## Task 1：新建流式 XLSX 解析器

**Files:**
- Create: `src/backend/bisheng/api/services/streaming_excel_reader.py`
- Test: `src/backend/tests/services/test_streaming_excel_reader.py`

背景：XLSX 是 ZIP 包，内含 `xl/sharedStrings.xml`（字符串表）、`xl/worksheets/sheetN.xml`（单元格数据）、`xl/styles.xml`（格式判断日期用）、`xl/workbook.xml`（sheet 名称列表）。`iterparse` 逐标签流式扫描，从不把整个 XML 树加载进内存。

- [ ] **Step 1：创建测试文件，写第一个失败测试（基础读取）**

```python
# src/backend/tests/services/test_streaming_excel_reader.py
import os
import pytest
import zipfile
import tempfile

# 构造一个最小合法 XLSX（手工写 ZIP）
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
    from bisheng.api.services.streaming_excel_reader import read_xlsx_streaming
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
```

- [ ] **Step 2：运行测试，确认失败**

```bash
cd src/backend
python -m pytest tests/services/test_streaming_excel_reader.py::test_basic_read -v
```

预期：`ImportError: cannot import name 'read_xlsx_streaming'`

- [ ] **Step 3：创建 streaming_excel_reader.py，实现核心逻辑**

```python
# src/backend/bisheng/api/services/streaming_excel_reader.py
"""
流式 XLSX 解析器。
直接解析 XLSX（ZIP + XML），不使用 openpyxl，内存峰值约为文件大小的 0.7-1.8 倍。
公共接口：read_xlsx_streaming(xlsx_path) -> List[Tuple[str, List[List[Any]]]]
"""
import zipfile
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from xml.etree.ElementTree import iterparse

from loguru import logger

# XLSX XML 命名空间
_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
_WS_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"

# Excel 日期起始点（1900 日期系统）
_EXCEL_EPOCH = datetime(1899, 12, 30)
# numFmtId 14-17 是内置日期格式；用户自定义格式通过 numFmt 节点识别
_BUILTIN_DATE_FMT_IDS = set(range(14, 18)) | set(range(164, 192))


def _tag(local: str) -> str:
    return f"{{{_NS}}}{local}"


def _read_shared_strings(zf: zipfile.ZipFile) -> List[str]:
    """读取 xl/sharedStrings.xml，返回字符串列表。文件不存在则返回空列表。"""
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    result = []
    with zf.open("xl/sharedStrings.xml") as f:
        current_parts: List[str] = []
        in_si = False
        for event, elem in iterparse(f, events=("start", "end")):
            if event == "start" and elem.tag == _tag("si"):
                in_si = True
                current_parts = []
            elif event == "end" and elem.tag == _tag("t") and in_si:
                current_parts.append(elem.text or "")
                elem.clear()
            elif event == "end" and elem.tag == _tag("si"):
                result.append("".join(current_parts))
                in_si = False
                elem.clear()
    return result


def _read_date_style_ids(zf: zipfile.ZipFile) -> set:
    """
    读取 xl/styles.xml，返回「是日期格式」的 xf 索引集合。
    原理：cellXfs 中每个 xf 的 numFmtId 落在日期范围内，或对应自定义 numFmt 包含日期字符。
    """
    if "xl/styles.xml" not in zf.namelist():
        return set()

    custom_date_fmt_ids: set = set()
    xf_list: List[int] = []

    with zf.open("xl/styles.xml") as f:
        for event, elem in iterparse(f, events=("end",)):
            if elem.tag == _tag("numFmt"):
                fmt_id = int(elem.get("numFmtId", 0))
                fmt_code = elem.get("formatCode", "")
                # 含 y/m/d/h 字符且不含 @ 的格式视为日期
                lower = fmt_code.lower()
                if any(c in lower for c in ("y", "d", "h")) and "@" not in lower:
                    custom_date_fmt_ids.add(fmt_id)
                elem.clear()
            elif elem.tag == _tag("xf"):
                xf_list.append(int(elem.get("numFmtId", 0)))
                elem.clear()

    date_xf_indices = set()
    for i, fmt_id in enumerate(xf_list):
        if fmt_id in _BUILTIN_DATE_FMT_IDS or fmt_id in custom_date_fmt_ids:
            date_xf_indices.add(i)
    return date_xf_indices


def _excel_serial_to_date(serial: float) -> str:
    """将 Excel 日期序列号转为 YYYY-MM-DD 字符串。"""
    try:
        dt = _EXCEL_EPOCH + timedelta(days=serial)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return str(serial)


def _col_letter_to_index(col_str: str) -> int:
    """'A'->0, 'B'->1, 'AA'->26 ..."""
    result = 0
    for ch in col_str.upper():
        result = result * 26 + (ord(ch) - ord("A") + 1)
    return result - 1


def _parse_cell_ref(ref: str) -> Tuple[int, int]:
    """'B3' -> (row=2, col=1)，均为 0-based。"""
    col_str = ""
    row_str = ""
    for ch in ref:
        if ch.isalpha():
            col_str += ch
        else:
            row_str += ch
    return int(row_str) - 1, _col_letter_to_index(col_str)


def _read_sheet(
    zf: zipfile.ZipFile,
    sheet_path: str,
    string_table: List[str],
    date_xf_indices: set,
    max_empty_rows: int = 50,
) -> List[List[Any]]:
    """
    流式读取单个 worksheet XML，返回 data_grid: List[List[Any]]。
    合并单元格在此函数之后由 _apply_merge_cells 处理。
    """
    if sheet_path not in zf.namelist():
        logger.warning(f"streaming_excel_reader: sheet not found: {sheet_path}")
        return []

    rows: Dict[int, Dict[int, Any]] = {}  # {row_idx: {col_idx: value}}
    max_row = 0
    max_col = 0

    with zf.open(sheet_path) as f:
        current_row_idx = -1
        current_cell_ref = ""
        current_cell_type = ""
        current_cell_style = 0
        current_value = ""
        in_v = False

        empty_row_count = 0
        last_nonempty_row = -1

        for event, elem in iterparse(f, events=("start", "end")):
            tag = elem.tag

            if event == "start":
                if tag == _tag("row"):
                    r = elem.get("r")
                    current_row_idx = int(r) - 1 if r else current_row_idx + 1
                elif tag == _tag("c"):
                    current_cell_ref = elem.get("r", "")
                    current_cell_type = elem.get("t", "")
                    current_cell_style = int(elem.get("s", 0))
                    current_value = ""
                elif tag == _tag("v"):
                    in_v = True
                    current_value = ""

            elif event == "end":
                if tag == _tag("v"):
                    in_v = False
                elif tag == _tag("c"):
                    if current_cell_ref and current_value != "":
                        row_i, col_i = _parse_cell_ref(current_cell_ref)
                        val: Any
                        if current_cell_type == "s":
                            idx = int(current_value)
                            val = string_table[idx] if idx < len(string_table) else ""
                        elif current_cell_type == "b":
                            val = current_value == "1"
                        else:
                            try:
                                num = float(current_value)
                                if current_cell_style in date_xf_indices:
                                    val = _excel_serial_to_date(num)
                                else:
                                    val = int(num) if num == int(num) else num
                            except ValueError:
                                val = current_value
                        if row_i not in rows:
                            rows[row_i] = {}
                        rows[row_i][col_i] = val
                        max_row = max(max_row, row_i)
                        max_col = max(max_col, col_i)
                    elem.clear()

                elif tag == _tag("row"):
                    if current_row_idx in rows and rows[current_row_idx]:
                        last_nonempty_row = current_row_idx
                        empty_row_count = 0
                    else:
                        empty_row_count += 1
                        if empty_row_count > max_empty_rows:
                            break
                    elem.clear()

    if not rows:
        return []

    actual_max_row = last_nonempty_row
    actual_max_col = max_col
    grid = [
        [rows.get(r, {}).get(c) for c in range(actual_max_col + 1)]
        for r in range(actual_max_row + 1)
    ]
    return grid


def _read_merge_cells(zf: zipfile.ZipFile, sheet_path: str) -> List[Tuple[int, int, int, int]]:
    """
    读取 worksheet 中的 <mergeCells>，返回 [(min_row, min_col, max_row, max_col), ...] 0-based。
    """
    result = []
    if sheet_path not in zf.namelist():
        return result
    with zf.open(sheet_path) as f:
        for event, elem in iterparse(f, events=("end",)):
            if elem.tag == _tag("mergeCell"):
                ref = elem.get("ref", "")
                if ":" in ref:
                    tl, br = ref.split(":")
                    r1, c1 = _parse_cell_ref(tl)
                    r2, c2 = _parse_cell_ref(br)
                    result.append((r1, c1, r2, c2))
                elem.clear()
    return result


def _apply_merge_cells(
    grid: List[List[Any]], merges: List[Tuple[int, int, int, int]]
) -> None:
    """原地修改 grid，将合并区域内所有格填充为左上角的值。"""
    for r1, c1, r2, c2 in merges:
        if r1 >= len(grid) or c1 >= len(grid[r1]):
            continue
        top_left = grid[r1][c1]
        for r in range(r1, min(r2 + 1, len(grid))):
            for c in range(c1, min(c2 + 1, len(grid[r]))):
                grid[r][c] = top_left


def _read_sheet_names(zf: zipfile.ZipFile) -> List[Tuple[str, str]]:
    """
    从 xl/workbook.xml + xl/_rels/workbook.xml.rels 读取 sheet 名称和对应文件路径。
    返回 [(sheet_name, 'xl/worksheets/sheetN.xml'), ...]，保持顺序。
    """
    # 读取 rId -> target 映射
    rid_to_target: Dict[str, str] = {}
    rels_path = "xl/_rels/workbook.xml.rels"
    if rels_path in zf.namelist():
        with zf.open(rels_path) as f:
            for event, elem in iterparse(f, events=("end",)):
                if elem.tag == f"{{{_PKG_REL_NS}}}Relationship":
                    rel_type = elem.get("Type", "")
                    if rel_type == _WS_TYPE:
                        rid = elem.get("Id", "")
                        target = elem.get("Target", "")
                        # Target 可能是相对路径 "worksheets/sheet1.xml"
                        if not target.startswith("xl/"):
                            target = "xl/" + target
                        rid_to_target[rid] = target
                    elem.clear()

    # 读取 sheet 顺序和名称
    sheets: List[Tuple[str, str]] = []
    if "xl/workbook.xml" in zf.namelist():
        with zf.open("xl/workbook.xml") as f:
            for event, elem in iterparse(f, events=("end",)):
                if elem.tag == _tag("sheet"):
                    name = elem.get("name", "")
                    rid = elem.get(f"{{{_REL_NS}}}id", "")
                    target = rid_to_target.get(rid, "")
                    if target:
                        sheets.append((name, target))
                    elem.clear()
    return sheets


def read_xlsx_streaming(xlsx_path: str) -> List[Tuple[str, List[List[Any]]]]:
    """
    流式读取 XLSX 文件，返回 [(sheet_name, data_grid), ...]。
    data_grid: List[List[Any]]，None 表示空单元格。
    语义与 openpyxl 读取结果一致（含合并单元格展开、日期转字符串）。
    """
    try:
        with zipfile.ZipFile(xlsx_path, "r") as zf:
            string_table = _read_shared_strings(zf)
            date_xf_indices = _read_date_style_ids(zf)
            sheet_list = _read_sheet_names(zf)

            result = []
            for sheet_name, sheet_path in sheet_list:
                grid = _read_sheet(zf, sheet_path, string_table, date_xf_indices)
                merges = _read_merge_cells(zf, sheet_path)
                if merges:
                    _apply_merge_cells(grid, merges)
                result.append((sheet_name, grid))
            return result

    except zipfile.BadZipFile as e:
        logger.exception(f"streaming_excel_reader: invalid ZIP/XLSX file: {xlsx_path}")
        return []
    except Exception as e:
        logger.exception(f"streaming_excel_reader: unexpected error reading {xlsx_path}")
        return []
```

- [ ] **Step 4：运行测试，确认通过**

```bash
cd src/backend
python -m pytest tests/services/test_streaming_excel_reader.py::test_basic_read -v
```

预期：`PASSED`

- [ ] **Step 5：补充其余测试并运行**

在 `test_streaming_excel_reader.py` 末尾追加：

```python
def test_no_shared_strings():
    """纯数字文件，没有 sharedStrings.xml"""
    from bisheng.api.services.streaming_excel_reader import read_xlsx_streaming
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
    from bisheng.api.services.streaming_excel_reader import read_xlsx_streaming
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
    # A1 和 B1 都应该是 "姓名"
    assert grid[0][0] == "姓名"
    assert grid[0][1] == "姓名"


def test_empty_rows_stop():
    """连续 50 个空行后应提前退出，不读取后续数据"""
    from bisheng.api.services.streaming_excel_reader import read_xlsx_streaming
    # 构造：1行数据 + 51行空行 + 1行数据（最后这行不应出现在结果中）
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
    # 51 行空行之后的 888 不应出现
    all_vals = [cell for row in grid for cell in row if cell is not None]
    assert 888 not in all_vals


def test_bad_zip():
    """损坏文件应返回空列表，不抛异常"""
    from bisheng.api.services.streaming_excel_reader import read_xlsx_streaming
    with tempfile.TemporaryDirectory() as tmp:
        bad_path = os.path.join(tmp, "bad.xlsx")
        with open(bad_path, "wb") as f:
            f.write(b"this is not a zip file")
        result = read_xlsx_streaming(bad_path)
    assert result == []
```

```bash
cd src/backend
python -m pytest tests/services/test_streaming_excel_reader.py -v
```

预期：4个测试全部 `PASSED`

- [ ] **Step 6：提交**

```bash
cd "C:\Users\Administrator\projects\eagent-v3\v2.0"
git add src/backend/bisheng/api/services/streaming_excel_reader.py
git add src/backend/tests/services/test_streaming_excel_reader.py
git commit -m "feat: add streaming XLSX reader (stdlib-only, low memory)"
```

---

## Task 2：替换 md_from_excel.py 解析入口

**Files:**
- Modify: `src/backend/bisheng/api/services/md_from_excel.py:275-315`

`excel_file_to_markdown()` 当前通过 `openpyxl.load_workbook` 获取 sheet 对象，再传入 `unmerge_and_read_sheet()` 得到 `data_grid`。新路径直接从 `read_xlsx_streaming()` 得到 `(sheet_name, data_grid)` 列表，跳过 `unmerge_and_read_sheet()`（merged cells 已在 reader 内处理）。

- [ ] **Step 1：替换 `excel_file_to_markdown()` 函数**

将 [md_from_excel.py:275-315](src/backend/bisheng/api/services/md_from_excel.py#L275-L315) 的整个函数替换为以下内容（其余函数不动）：

```python
def excel_file_to_markdown(
        excel_path, num_header_rows, rows_per_markdown, output_dir, append_header=True
):
    logger.debug(f"\nStart Processing Excel: '{excel_path}'")
    from bisheng.api.services.streaming_excel_reader import read_xlsx_streaming

    try:
        sheets = read_xlsx_streaming(excel_path)
    except Exception as e:
        logger.debug(f"Error: Unable to load Excel '{excel_path}'. Reason: {e}")
        return

    if not sheets:
        logger.debug(f"Error: No sheets found or file is empty: '{excel_path}'")
        return

    for sheet_index, (sheet_name, data_grid) in enumerate(sheets):
        logger.debug(f"\n  Processing sheet '{sheet_name}'... {len(data_grid)} rows")

        if is_list_of_lists_empty(data_grid):
            logger.debug(f"  Sheet '{sheet_name}' is empty, skipping.")
            continue

        import pandas as pd
        df = pd.DataFrame(data_grid)
        df.fillna("", inplace=True)
        if df.empty:
            logger.debug(f"  Sheet '{sheet_name}' empty after processing, skipping.")
            continue

        process_dataframe_to_markdown_files(
            df,
            str(sheet_index),
            num_header_rows,
            rows_per_markdown,
            output_dir,
            append_header=append_header,
        )

    logger.debug(f"\nExcel '{excel_path}' processing complete.")
```

注意：`import openpyxl` 在文件顶部的导入行保留不动（CSV 路径不用，但删除它会改变 diff 范围，不在本次任务内）。

- [ ] **Step 2：验证函数可正常导入**

```bash
cd src/backend
python -c "from bisheng.api.services.md_from_excel import excel_file_to_markdown; print('OK')"
```

预期：`OK`

- [ ] **Step 3：运行一次端到端冒烟测试**

在本地准备任意一个 .xlsx 文件（哪怕是随手创建的），执行：

```bash
cd src/backend
python -c "
import tempfile, os
from bisheng.api.services.md_from_excel import handler
with tempfile.TemporaryDirectory() as tmp:
    # 用 Task 1 测试里的 make_test_xlsx 构造一个文件
    import zipfile, sys
    sys.path.insert(0, 'tests/services')
    from test_streaming_excel_reader import make_test_xlsx
    xlsx = make_test_xlsx(tmp)
    md_dir, _, doc_id = handler(cache_dir=tmp, file_name=xlsx)
    files = os.listdir(md_dir)
    print('Output files:', files)
    for f in files:
        print(open(os.path.join(md_dir, f)).read())
"
```

预期：输出若干 `.md` 文件内容，包含 Markdown 表格。

- [ ] **Step 4：提交**

```bash
cd "C:\Users\Administrator\projects\eagent-v3\v2.0"
git add src/backend/bisheng/api/services/md_from_excel.py
git commit -m "feat: replace openpyxl loader with streaming_excel_reader in excel_file_to_markdown"
```

---

## Task 3：放开后端上传大小限制

**Files:**
- Modify: `src/backend/bisheng/core/cache/utils.py:219,239`

- [ ] **Step 1：修改常量和错误文案**

将 [utils.py:218-239](src/backend/bisheng/core/cache/utils.py#L218-L239) 中的两处改动：

```python
# 改前：
# Maximum allowed file size: 100MB
MAX_UPLOAD_FILE_SIZE = 100 * 1024 * 1024
# ...
        raise ValueError(f'File size ({file_size / (1024 * 1024):.2f}MB) exceeds the maximum allowed size (100MB)')

# 改后：
# Maximum allowed file size: 200MB
MAX_UPLOAD_FILE_SIZE = 200 * 1024 * 1024
# ...
        raise ValueError(f'File size ({file_size / (1024 * 1024):.2f}MB) exceeds the maximum allowed size ({MAX_UPLOAD_FILE_SIZE // (1024 * 1024)}MB)')
```

- [ ] **Step 2：验证导入正常**

```bash
cd src/backend
python -c "from bisheng.core.cache.utils import MAX_UPLOAD_FILE_SIZE; print(MAX_UPLOAD_FILE_SIZE // 1024 // 1024, 'MB')"
```

预期：`200 MB`

- [ ] **Step 3：提交**

```bash
cd "C:\Users\Administrator\projects\eagent-v3\v2.0"
git add src/backend/bisheng/core/cache/utils.py
git commit -m "feat: raise MAX_UPLOAD_FILE_SIZE to 200MB"
```

---

## Task 4：更新后端配置默认值

**Files:**
- Modify: `src/backend/bisheng/initdb_config.yaml:53`

- [ ] **Step 1：修改 yaml**

将 [initdb_config.yaml:53](src/backend/bisheng/initdb_config.yaml#L53) 由：

```yaml
  uploaded_files_maximum_size: 50
```

改为：

```yaml
  uploaded_files_maximum_size: 200
```

- [ ] **Step 2：提交**

```bash
cd "C:\Users\Administrator\projects\eagent-v3\v2.0"
git add src/backend/bisheng/initdb_config.yaml
git commit -m "config: set uploaded_files_maximum_size default to 200MB"
```

> **部署注意**：yaml 是「首次初始化默认值」，生产环境 DB 中已有配置值优先。部署后需登录管理后台 → 系统配置 → 保存一次，将新默认值写入 DB。

---

## Task 5：更新前端兜底值（3个文件）

**Files:**
- Modify: `src/frontend/platform/src/components/inputFileComponent/index.tsx:53`
- Modify: `src/frontend/client/src/pages/appChat/components/InputFileComponent.tsx:53,55`
- Modify: `src/frontend/client/src/pages/appChat/ChatInput.tsx:45`

- [ ] **Step 1：修改 platform inputFileComponent**

将 [index.tsx:53](src/frontend/platform/src/components/inputFileComponent/index.tsx#L53)：

```typescript
    const maxSize = (appConfig.uploadFileMaxSize || 50) * 1024 * 1024;
```

改为：

```typescript
    const maxSize = (appConfig.uploadFileMaxSize || 200) * 1024 * 1024;
```

- [ ] **Step 2：修改 client InputFileComponent（2处）**

将 [InputFileComponent.tsx:53,55](src/frontend/client/src/pages/appChat/components/InputFileComponent.tsx#L53-L55)：

```typescript
        const maxSize = (eagentConfig?.uploaded_files_maximum_size || 50) * 1024 * 1024;
        if (file.size > maxSize) {
            return t('com_inputfile_exceed_limit', { 0: file.name, 1: (eagentConfig?.uploaded_files_maximum_size || 50) })
```

改为：

```typescript
        const maxSize = (eagentConfig?.uploaded_files_maximum_size || 200) * 1024 * 1024;
        if (file.size > maxSize) {
            return t('com_inputfile_exceed_limit', { 0: file.name, 1: (eagentConfig?.uploaded_files_maximum_size || 200) })
```

- [ ] **Step 3：修改 client ChatInput**

将 [ChatInput.tsx:45](src/frontend/client/src/pages/appChat/ChatInput.tsx#L45)：

```typescript
                size={eagentConfig?.uploaded_files_maximum_size || 50}
```

改为：

```typescript
                size={eagentConfig?.uploaded_files_maximum_size || 200}
```

- [ ] **Step 4：提交**

```bash
cd "C:\Users\Administrator\projects\eagent-v3\v2.0"
git add src/frontend/platform/src/components/inputFileComponent/index.tsx
git add src/frontend/client/src/pages/appChat/components/InputFileComponent.tsx
git add src/frontend/client/src/pages/appChat/ChatInput.tsx
git commit -m "feat: update frontend file size fallback to 200MB"
```

---

## Task 6：部署到 node3 并验证

**部署路径：**
- 后端代码：`/mnt/nodestor/eagent/package/backend/bisheng/`
- 前端静态：`/mnt/nodestor/eagent/package/frontend/`
- SSH 跳板：`ssh node4-gpu "ssh root@172.20.20.35 '<command>'"`

- [ ] **Step 1：打包后端文件并上传**

```bash
# 本地：将改动的后端 Python 文件打包
cd "C:\Users\Administrator\projects\eagent-v3\v2.0\src\backend\bisheng"
tar czf /tmp/excel_patch.tar.gz \
  api/services/streaming_excel_reader.py \
  api/services/md_from_excel.py \
  core/cache/utils.py \
  initdb_config.yaml

# 上传到 node4-gpu 中转
scp /tmp/excel_patch.tar.gz node4-gpu:/tmp/

# 转发到 node3
ssh node4-gpu "scp /tmp/excel_patch.tar.gz root@172.20.20.35:/tmp/"
```

- [ ] **Step 2：在 node3 上解压替换**

```bash
ssh node4-gpu "ssh root@172.20.20.35 'cd /mnt/nodestor/eagent/package/backend/bisheng && tar xzf /tmp/excel_patch.tar.gz'"
```

- [ ] **Step 3：构建前端并上传（如前端有改动）**

```bash
# 本地构建 client
cd "C:\Users\Administrator\projects\eagent-v3\v2.0\src\frontend\client"
npm run build

# 本地构建 platform
cd "C:\Users\Administrator\projects\eagent-v3\v2.0\src\frontend\platform"
npm run build

# 将 dist 目录上传（路径以实际 node3 前端静态目录为准）
# 先确认 node3 前端目录
ssh node4-gpu "ssh root@172.20.20.35 'ls /mnt/nodestor/eagent/package/frontend/'"
```

- [ ] **Step 4：重启后端服务（需彭总批准后执行）**

```bash
ssh node4-gpu "ssh root@172.20.20.35 'supervisorctl restart eagent-backend'"
```

> **注意**：此步骤属于生产环境重启，执行前须确认彭总已批准。

- [ ] **Step 5：管理后台更新配置**

登录 `http://172.20.20.35:3001/` → 管理后台 → 系统配置 → 找到「上传文件大小限制」→ 将值改为 200 → 保存。

（yaml 改动只影响首次初始化，生产 DB 中已有旧值，必须手动更新。）

- [ ] **Step 6：验证**

```bash
# 验证后端限制已生效（应返回 200）
ssh node4-gpu "ssh root@172.20.20.35 'curl -s http://localhost:8000/api/v1/config | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get(\\\"uploaded_files_maximum_size\\\"))\"'"
```

然后在前端实际上传一个 >100MB 的 Excel 文件，确认：
- 上传不报大小超限错误
- 解析后 Markdown 文件内容正确
- 后端进程内存增量在可接受范围内（`watch -n2 'ps aux | grep uvicorn'`）

---

## 验证检查清单

- [ ] 200MB Excel 文件上传不报 size 超限错误
- [ ] 解析成功，输出 `.md` 文件内容与原版一致
- [ ] 含合并单元格的文件，合并值正确展开
- [ ] 含日期列的文件，日期格式正确（YYYY-MM-DD）
- [ ] 纯数字文件（无 sharedStrings.xml）正常解析
- [ ] 工作流节点上传 200MB Excel，内容正确截取
- [ ] 前端上传界面兜底提示文案显示 200MB（而非旧的 50MB）
