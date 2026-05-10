# Dansk Privacy Filter

En browserbaseret dansk prototype til at maskere personoplysninger i tekst, Markdown, TXT og DOCX, før teksten bruges videre.

## Hvad den gør

- Kører OpenAI Privacy Filter (`openai/privacy-filter`) i brugerens browser via Transformers.js.
- Understøtter direkte tekstinput samt upload af `.docx`, `.md`, `.markdown` og `.txt`.
- Maskerer fundne spans med enten kategorilabels som `[PRIVATE_EMAIL]` eller blokke.
- Lader brugeren kopiere eller downloade den privacy-venlige tekst som `.txt`.

## Privatlivsmodel

Dokumentindholdet behandles lokalt i browseren. Første kørsel downloader modelvægte fra Hugging Face og gemmer dem i browserens cache, men appen har ingen server-side uploadflow for brugerens tekst.

OpenAI beskriver Privacy Filter som en lille, lokal-kørbar tokenklassifikationsmodel til PII-detektion og maskering. Modellen kan ifølge modelkortet bruges med Transformers.js og er udgivet under Apache 2.0.

## Kom i gang

```bash
npm install
npm run dev
```

Byg produktion:

```bash
npm run build
```

> Bemærk: Privacy Filter er et hjælpeværktøj, ikke en compliance-garanti. Brug menneskelig review ved følsomme juridiske, medicinske eller finansielle workflows.
