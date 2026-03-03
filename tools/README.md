# Glossary Format Converter

多格式词汇表转换工具 / Convert glossary files between multiple formats

## 支持的格式 / Supported Formats

| 格式 Format | 扩展名 Extension | 输入 Input | 输出 Output |
|------------|-----------------|:----------:|:----------:|
| Excel | `.xlsx`, `.xls` | ✅ | ✅ |
| CSV | `.csv` | ✅ | ✅ |
| JSON | `.json` | ✅ | ✅ |
| YAML | `.yaml`, `.yml` | ✅ | ✅ |

## 安装依赖 / Install Dependencies

```bash
npm install
```

## 使用方法 / Usage

### 基本用法 / Basic Usage

```bash
npm run convert <input-file> <output-file>
```

### 转换示例 / Conversion Examples

```bash
# XLSX → JSON (推荐用于 bot)
npm run convert glossary.xlsx src/data/glossary.json

# CSV → JSON
npm run convert terms.csv data.json

# JSON → CSV
npm run convert glossary.json export.csv

# JSON → YAML
npm run convert glossary.json export.yaml

# XLSX → CSV
npm run convert input.xlsx output.csv
```

### 直接使用 node / Direct Node Usage

```bash
node tools/convert-glossary.js input.xlsx output.json
```

## 数据格式 / Data Format

### 标准格式 (JSON)

```json
[
  {
    "cn": "冒险者",
    "en": "Adventurer",
    "context": "玩家称呼"
  },
  {
    "cn": "维护",
    "en": "Maintenance",
    "context": "服务器维护"
  }
]
```

### Excel/CSV 列名支持

工具会自动识别以下列名：

| 中文 | 英文 |
|------|------|
| cn, 中文, Chinese, 中文名 | en, English, 英文, 英文名 |
| context, ctx, 上下文, note, notes | (same) |

## 词汇表文件位置 / Glossary File Location

转换后的 JSON 文件应放在：

```
src/data/glossary.json
```

Bot 会自动从此位置加载词汇表。
