"""Retter for bred Ø/ø i Barlow Condensed (fontsource, latin-subset).

Glyfen Oslash har ca. 120-160 enheter ekstra luft til høyre, så «Økter»
vises som «Ø kter». Skriptet setter bredden slik at luften til høyre blir
lik som for O/o, og lagrer filene i public/fonts/.
Kjøres én gang: python3 scripts/fiks-barlow-condensed.py

Delingsbildene (src/pages/og/) bruker TTF-kopier av de rettede filene i
src/assets/fonts/, fordi satori ikke leser woff2.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

KILDE = 'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-{w}-normal.woff2'
for w in ['500', '600', '700']:
    f = TTFont(KILDE.format(w=w))
    cmap, hm, gs = f.getBestCmap(), f['hmtx'], f.getGlyphSet()

    def hoyre_kant(g):
        p = BoundsPen(gs)
        gs[g].draw(p)
        return p.bounds[2]

    for feil, mal in [('Ø', 'O'), ('ø', 'o')]:
        g, m = cmap[ord(feil)], cmap[ord(mal)]
        rsb_mal = hm[m][0] - hoyre_kant(m)
        ny = round(hoyre_kant(g) + rsb_mal)
        print(w, feil, hm[g][0], '->', ny)
        hm[g] = (ny, hm[g][1])
    f.flavor = 'woff2'
    f.save(f'public/fonts/barlow-condensed-{w}.woff2')
