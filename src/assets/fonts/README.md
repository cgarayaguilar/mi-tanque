# Fuentes del PDF de viajes

`Inter-Regular.subset.ttf` e `Inter-SemiBold.subset.ttf` son **Inter**, la fuente de la app,
recortada para los PDF de viajes (backend specs/0041 RF-8). La licencia es la SIL Open Font
License 1.1 (`OFL.txt`).

- **Origen:** los TTF `Inter_400Regular.ttf` e `Inter_600SemiBold.ttf` del paquete de npm
  `@expo-google-fonts/inter@0.4.2`.
- **Recorte:** letras latinas, signos, símbolos de moneda y flechas. Hecho con `pyftsubset`, de
  `fonttools`:

```bash
pyftsubset Inter_400Regular.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0152-0153,U+0160-0161,U+0178,U+017D-017E,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20A0-20CF,U+2190-2193" \
  --layout-features='' --no-hinting --output-file=Inter-Regular.subset.ttf
```

Lo mismo con `Inter_600SemiBold.ttf`. Si se amplía el recorte, también `PDF_FONT_RANGES` en
`src/utils/tripReport.ts`, que quita del PDF lo que la fuente no tiene.
