# 200MB Excel 文件上传支持设计

**日期**：2026-06-02  
**状态**：已批准，待实现  
**范围**：知识库上传路径 + 工作流直接上传路径

---

## 一、问题定义

### 现状限制链

| 层级 | 当前限制 | 目标 |
|------|---------|------|
| Nginx | 200MB | ✅ 已符合，无需改动 |
| 后端常量 `MAX_UPLOAD_FILE_SIZE` | 100MB | 200MB |
| 后端错误文案 | 硬编码 "100MB" | 动态取值 |
| 数据库/配置默认值 `uploaded_files_maximum_size` | 50MB | 200MB |
| 前端兜底值（3处） | 50MB | 200MB |

### 解析层内存问题

`openpyxl.load_workbook(read_only=False)` 将整个 workbook 解压到内存：

| 文件大小 | 峰值内存 |
|---------|---------|
| 50MB   | 750MB–1.7GB |
| 100MB  | 1.5GB–3.5GB |
| 200MB  | 3GB–7GB（不可接受） |

根本原因：openpyxl 在 `read_only=False` 模式下构建完整 DOM 树，内存放大倍率约 15-35×。

---

## 二、选型决策

**方案 B：完整改造——放开限制 + 重写解析器**（已批准）

选择理由：
- 方案 A（只放开限制）短期可行，但多用户并发上传时内存风险叠加
- 方案 B 改造范围精确，新解析器边界清晰，不影响任何下游调用路径
- node3 内存 503GB 充裕，但不应浪费在可避免的 DOM 膨胀上

`.xls` 格式：忽略，不在本次改动范围内。

---

## 三、架构设计

```
限制层（5处改动，零逻辑变化）
────────────────────────────────────────────────────
  utils.py:219         MAX_UPLOAD_FILE_SIZE  100MB → 200MB
  utils.py:239         错误文案              硬编码 → 动态
  initdb_config.yaml   uploaded_files_maximum_size  50 → 200
  inputFileComponent/index.tsx              fallback 50 → 200
  InputFileComponent.tsx（client，2处）     fallback 50 → 200
  ChatInput.tsx                             fallback 50 → 200

解析层（1新文件 + 1函数入口替换）
────────────────────────────────────────────────────
  streaming_excel_reader.py（新建）
    read_xlsx_streaming(xlsx_path) → List[Tuple[str, List[List]]]

  md_from_excel.py
    excel_file_to_markdown() 第280行：
      openpyxl.load_workbook(...) → read_xlsx_streaming()
      遍历方式从 workbook[sheet_name] 改为遍历返回 list
      unmerge_and_read_sheet() 旁路（merged cells 已在 reader 内处理）
```

所有下游函数（`process_dataframe_to_markdown_files`、`generate_markdown_table_string`）**完全不动**。

所有上层调用路径（知识库同步、知识库异步、工作流 InputNode、Workstation 直传、Open API）**完全不动**。

---

## 四、streaming_excel_reader.py 详细设计

### 原理

XLSX 是 ZIP 包，内含：
- `xl/sharedStrings.xml`：所有字符串的共享表
- `xl/worksheets/sheetN.xml`：每个工作表的单元格数据
- `xl/styles.xml`：单元格格式（用于判断日期列）
- `xl/workbook.xml`：工作表名称列表

流式读取分两遍，从不把整个文件加载进内存：

```
第一遍：读 sharedStrings.xml
  用 iterparse 逐标签扫描
  建 string_table: List[str]
  读完即关闭

第二遍：逐 sheet 读取
  打开对应 sheetN.xml
  iterparse 逐行收集 <row> 节点
  遇连续 50 个空行提前退出（复用原有逻辑）
  合并单元格：读 <mergeCells> 节点，填充顶左值到范围内其他格
  读完即关闭
```

### 公共接口

```python
def read_xlsx_streaming(xlsx_path: str) -> List[Tuple[str, List[List[Any]]]]:
    """
    流式读取 XLSX，返回 [(sheet_name, data_grid), ...]
    data_grid: List[List[Any]]，None 表示空单元格
    语义与 openpyxl 版本完全一致
    """
```

### 内存峰值对比

| 文件大小 | openpyxl read_only=False | streaming_excel_reader |
|---------|--------------------------|------------------------|
| 50MB   | 750MB–1.7GB              | 30–80MB                |
| 100MB  | 1.5GB–3.5GB              | 61–166MB               |
| 200MB  | 3GB–7GB                  | 130–350MB              |

### 边界场景

| 场景 | 处理方式 |
|------|---------|
| 日期单元格 | 读 `xl/styles.xml` 判断 numFmtId，将 Excel 序列号转为 `YYYY-MM-DD` 字符串 |
| 无 sharedStrings.xml（纯数字文件） | 容错：直接读 `<v>` 节点 inline 值，跳过 string_table 查找 |
| 损坏的 ZIP | 捕获异常，`logger.exception`，返回空列表（与原版行为一致） |
| 空 sheet | 返回空 data_grid，上层 `is_list_of_lists_empty()` 过滤（原有逻辑不变） |

### 依赖

仅使用 Python 标准库：`zipfile`、`xml.etree.ElementTree`（iterparse）、`datetime`。  
**不引入任何新的第三方依赖。**

---

## 五、工作流文件内容截断

`input.py` 中 `dialog_files_content_size`（默认 15000 字符）和 `file_content_size`（默认 15000 字符）已是可配值，用户在工作流节点属性中直接填写即可。

**代码不改动**。只将 `initdb_config.yaml` 中相关默认值从 15000 调整为 50000，让新建工作流的默认体验更好。

---

## 六、改动汇总

| 文件 | 类型 | 改动量 |
|------|------|--------|
| `src/backend/bisheng/api/services/streaming_excel_reader.py` | 新建 | ~130行 |
| `src/backend/bisheng/api/services/md_from_excel.py` | 修改 | ~20行替换 |
| `src/backend/bisheng/core/cache/utils.py` | 修改 | 2行 |
| `src/backend/bisheng/initdb_config.yaml` | 修改 | 1行 |
| `src/frontend/platform/src/components/inputFileComponent/index.tsx` | 修改 | 1行 |
| `src/frontend/client/src/pages/appChat/components/InputFileComponent.tsx` | 修改 | 2行 |
| `src/frontend/client/src/pages/appChat/ChatInput.tsx` | 修改 | 1行 |

**合计**：1个新文件 + 6个小改动，无架构变化。

---

## 七、部署说明

目标环境：node3（172.20.20.35），裸机 supervisord 部署。

SSH 路径：`ssh node4-gpu "ssh root@172.20.20.35 '<command>'"`

部署步骤：
1. 替换后端 Python 文件至 `/mnt/nodestor/eagent/package/backend/bisheng/`
2. 替换前端静态文件至 `/mnt/nodestor/eagent/package/frontend/`
3. `supervisorctl restart eagent-backend`
4. 验证：上传 200MB Excel 文件，观察内存占用和解析结果

数据库配置更新：修改 `initdb_config.yaml` 后需在管理后台「系统配置」页保存一次，使配置写入 DB（DB 值优先于 yaml 默认值）。

---

## 八、验证标准

- [ ] 200MB Excel 文件上传不报 size 超限错误
- [ ] 解析成功，输出 `.md` 文件内容与 openpyxl 版本一致
- [ ] 解析过程中后端进程内存增量 < 500MB
- [ ] 含合并单元格的文件，合并值正确展开
- [ ] 含日期列的文件，日期格式正确输出
- [ ] 工作流节点上传 200MB Excel，file_content_size=50000 时内容正确截取
