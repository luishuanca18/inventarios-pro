from pathlib import Path
from pypdf import PdfReader
pdf = Path(r'C:\Users\LuisHuanca\Desktop\Contabilidad de costos un enfoque gerencial ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).pdf')
reader = PdfReader(str(pdf))
out = Path('tmp_pdf_extract.txt')
with out.open('w', encoding='utf-8') as f:
    f.write(f'PAGES: {len(reader.pages)}\n')
    for idx in range(8,18):
        text = reader.pages[idx].extract_text() or ''
        f.write(f'\n--- PAGE {idx+1} ---\n')
        f.write(text)
        f.write('\n')
print(out.resolve())
