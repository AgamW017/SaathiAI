import sys
from docling.document_converter import DocumentConverter

def main():
    with open("test.csv", "w") as f:
        f.write("Name,Phone,Trade\nJohn,1234567890,Welder\n")
    
    converter = DocumentConverter()
    result = converter.convert("test.csv")
    doc = result.document
    
    tables = []
    for t in getattr(doc, "tables", []):
        df = t.export_to_dataframe()
        columns = df.columns.tolist()
        data = df.fillna("").values.tolist()
        tables.append([columns] + data)
    
    print("TABLES:", tables)

if __name__ == "__main__":
    main()
