from pathlib import Path
from pypdf import PdfReader
pdf = Path(r'C:\Users\LuisHuanca\Desktop\Contabilidad de costos un enfoque gerencial ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).pdf')
reader = PdfReader(str(pdf))
out = Path('tmp_pdf_toc_1.txt')
with out.open('w', encoding='utf-8') as f:
    for idx in range(6,9):
        text = reader.pages[idx].extract_text() or ''
        f.write(f'\n--- PAGE {idx+1} ---\n{text}\n')
print(out.resolve())
