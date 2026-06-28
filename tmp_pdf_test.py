from pathlib import Path
from pypdf import PdfReader
pdf = Path(r'C:\Users\LuisHuanca\Desktop\Contabilidad de costos un enfoque gerencial ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).pdf')
reader = PdfReader(str(pdf))
for idx in [10,20,30,40,50,60,70,80,90,100,110,120]:
    text = reader.pages[idx].extract_text() or ''
    print('PAGE', idx+1, 'chars', len(text))
    print(text[:800].replace('\n',' '))
    print('---')
