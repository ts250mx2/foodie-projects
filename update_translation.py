import json
import sys
import os

def update_json(file_path, section, key, value):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if section not in data:
            data[section] = {}
        
        data[section][key] = value
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"Successfully updated {file_path}")
    except Exception as e:
        print(f"Error updating {file_path}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python update_translation.py <file_path> <section> <key> <value>")
        sys.exit(1)
    
    update_json(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
