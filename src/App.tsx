import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { extractTextFromFile } from './fileReader';
import type { PrivacySpan, RedactionMode, WorkerRequest, WorkerResponse } from './types';

const sampleText = `Hej Louise Jensen

Tak for samtalen. Du kan fange mig på anna.holm@example.dk eller +45 12 34 56 78, hvis kontrakten for konto 4571-8820-9912 skal opdateres før 12. juni 2026.

Vores interne nøgle er sk-test-1234567890abcdef.`;

const countByLabel = (spans: PrivacySpan[]) =>
  spans.reduce<Record<string, number>>((counts, span) => {
    counts[span.entity_group] = (counts[span.entity_group] ?? 0) + 1;
    return counts;
  }, {});

export function App() {
  const [inputText, setInputText] = useState(sampleText);
  const [outputText, setOutputText] = useState('');
  const [spans, setSpans] = useState<PrivacySpan[]>([]);
  const [mode, setMode] = useState<RedactionMode>('label');
  const [status, setStatus] = useState('Klar til lokal behandling.');
  const [isProcessing, setIsProcessing] = useState(false);
  const [runtime, setRuntime] = useState('Ikke indlæst endnu');
  const [fileName, setFileName] = useState('');
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./privacyWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      if (message.type === 'progress') {
        setStatus(message.progress ? `${message.message} (${Math.round(message.progress)}%)` : message.message);
      }

      if (message.type === 'result') {
        setOutputText(message.redactedText);
        setSpans(message.spans);
        setRuntime(message.runtime);
        setStatus(`Færdig: fandt ${message.spans.length} mulige private spans.`);
        setIsProcessing(false);
      }

      if (message.type === 'error') {
        setStatus(message.message);
        setIsProcessing(false);
      }
    };

    return () => workerRef.current?.terminate();
  }, []);

  const labelCounts = useMemo(() => countByLabel(spans), [spans]);

  const handleFile = async (file?: File) => {
    if (!file) {
      return;
    }

    setStatus('Læser dokument lokalt i browseren …');
    setFileName(file.name);
    const text = await extractTextFromFile(file);
    setInputText(text);
    setOutputText('');
    setSpans([]);
    setStatus(`Indlæste ${file.name}. Klar til filtrering.`);
  };

  const processText = () => {
    if (!inputText.trim() || !workerRef.current) {
      setStatus('Indsæt tekst eller upload et dokument først.');
      return;
    }

    setIsProcessing(true);
    setOutputText('');
    setSpans([]);
    const request: WorkerRequest = { id: crypto.randomUUID(), text: inputText, mode };
    workerRef.current.postMessage(request);
  };

  const copyOutput = async () => {
    await navigator.clipboard.writeText(outputText);
    setStatus('Den privacy-venlige tekst er kopieret.');
  };

  const downloadOutput = () => {
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName ? fileName.replace(/\.[^.]+$/, '') : 'privacy-filter'}-redacted.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">OpenAI Privacy Filter · dansk browserværktøj</p>
          <h1>Maskér personoplysninger før teksten forlader din computer.</h1>
          <p>
            Upload DOCX, Markdown eller TXT – eller indsæt tekst direkte. Selve det uredigerede indhold behandles lokalt i
            browseren med <code>openai/privacy-filter</code> via Transformers.js.
          </p>
        </div>
        <div className="privacy-card">
          <strong>Lokalt først</strong>
          <span>Dokumentet sendes ikke til en server. Første kørsel henter kun modelvægte fra Hugging Face.</span>
        </div>
      </section>

      <section className="panel controls" aria-label="Input og indstillinger">
        <label className="dropzone">
          <input
            type="file"
            accept=".docx,.md,.markdown,.txt,text/plain,text/markdown"
            onChange={(event: ChangeEvent<HTMLInputElement>) => void handleFile(event.target.files?.[0])}
          />
          <span>Upload .docx, .md eller .txt</span>
          <small>{fileName || 'Eller brug tekstfeltet nedenfor'}</small>
        </label>

        <fieldset>
          <legend>Maskering</legend>
          <label>
            <input type="radio" name="mode" checked={mode === 'label'} onChange={() => setMode('label')} />
            Bevar kategori, fx [PRIVATE_EMAIL]
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === 'block'} onChange={() => setMode('block')} />
            Erstat med blokke
          </label>
        </fieldset>

        <button type="button" onClick={processText} disabled={isProcessing}>
          {isProcessing ? 'Behandler lokalt …' : 'Lav privacy-venlig tekst'}
        </button>
      </section>

      <section className="workspace">
        <label className="editor-card">
          <span>Original tekst</span>
          <textarea value={inputText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInputText(event.target.value)} />
        </label>

        <label className="editor-card">
          <span>Privacy-venlig udgave</span>
          <textarea value={outputText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setOutputText(event.target.value)} placeholder="Resultatet vises her …" />
          <div className="actions">
            <button type="button" onClick={() => void copyOutput()} disabled={!outputText}>
              Kopiér
            </button>
            <button type="button" onClick={downloadOutput} disabled={!outputText}>
              Download TXT
            </button>
          </div>
        </label>
      </section>

      <section className="panel status" aria-live="polite">
        <div>
          <strong>Status</strong>
          <p>{status}</p>
          <small>Runtime: {runtime}</small>
        </div>
        <div>
          <strong>Fundne kategorier</strong>
          {Object.keys(labelCounts).length === 0 ? (
            <p>Ingen spans endnu.</p>
          ) : (
            <ul>
              {Object.entries(labelCounts).map(([label, count]) => (
                <li key={label}>
                  {label}: {count}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
