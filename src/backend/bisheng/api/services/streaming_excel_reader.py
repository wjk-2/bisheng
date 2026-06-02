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
                    current_value = elem.text or ""
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
    """原地修改 grid，将合并区域内所有格填充为左上角的值。
    若合并区域超出当前行/列范围，先扩展 grid 以容纳合并区域。
    """
    for r1, c1, r2, c2 in merges:
        if r1 >= len(grid):
            continue
        # 扩展 grid 行数（若合并行超出）
        while len(grid) <= r2:
            grid.append([None] * len(grid[0]) if grid else [])
        # 扩展每行列数（若合并列超出）
        for r in range(r1, r2 + 1):
            if r < len(grid) and len(grid[r]) <= c2:
                grid[r].extend([None] * (c2 + 1 - len(grid[r])))
        if c1 >= len(grid[r1]):
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
