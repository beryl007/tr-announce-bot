#!/usr/bin/env python3
"""
Excel Glossary to JSON Converter

Converts Teon Glossary from Excel format to JSON for the Slack bot.

Usage:
    python scripts/excel_to_json.py path/to/Glossary.xlsx
"""

import json
import sys
import os
from datetime import datetime

try:
    import pandas as pd
except ImportError:
    print("Error: pandas is not installed.")
    print("Install it with: pip install pandas openpyxl")
    sys.exit(1)


def convert_excel_to_json(excel_path, output_path=None):
    """
    Convert Excel glossary to JSON format.

    Args:
        excel_path: Path to the Excel file
        output_path: Path to output JSON file (default: data/glossary.json)
    """
    if output_path is None:
        output_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '..', 'data', 'glossary.json'
        )

    # Create data directory if it doesn't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Read Excel file
    print(f"Reading Excel file: {excel_path}")
    try:
        df = pd.read_excel(excel_path)
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        sys.exit(1)

    # Check required columns
    required_columns = ['cn', 'en']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        print(f"Error: Missing required columns: {missing_columns}")
        print(f"Available columns: {list(df.columns)}")
        sys.exit(1)

    # Convert to glossary format
    glossary = []
    for _, row in df.iterrows():
        term = {
            'cn': str(row['cn']) if pd.notna(row['cn']) else '',
            'en': str(row['en']) if pd.notna(row['en']) else ''
        }

        # Add optional fields if present
        if 'tw' in df.columns and pd.notna(row['tw']):
            term['tw'] = str(row['tw'])

        # Add textHash if present (from JSONC format)
        if 'textHash' in df.columns and pd.notna(row['textHash']):
            try:
                term['textHash'] = json.loads(row['textHash']) if isinstance(row['textHash'], str) else row['textHash']
            except:
                pass

        # Skip empty entries
        if term['cn'] or term['en']:
            glossary.append(term)

    # Write JSON file
    print(f"Converting {len(glossary)} terms...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(glossary, f, ensure_ascii=False, indent=2)

    print(f"✅ Successfully converted to: {output_path}")
    print(f"   Total terms: {len(glossary)}")

    # Show some examples
    if len(glossary) > 0:
        print("\nSample entries:")
        for term in glossary[:5]:
            print(f"  {term['cn']} → {term['en']}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/excel_to_json.py <path_to_glossary.xlsx> [output.json]")
        print("\nExample:")
        print("  python scripts/excel_to_json.py ~/Glossary.xlsx")
        print("  python scripts/excel_to_json.py ~/Glossary.xlsx custom_output.json")
        sys.exit(1)

    excel_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    if not os.path.exists(excel_path):
        print(f"Error: File not found: {excel_path}")
        sys.exit(1)

    convert_excel_to_json(excel_path, output_path)


if __name__ == '__main__':
    main()
