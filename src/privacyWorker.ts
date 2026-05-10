import { env, pipeline } from '@huggingface/transformers';
import type { PrivacySpan, RedactionMode, WorkerRequest, WorkerResponse } from './types';

type TokenClassifier = (
  text: string,
  options: { aggregation_strategy: 'simple' },
) => Promise<PrivacySpan[]>;

type ClassifierOptions = {
  device: 'webgpu' | 'wasm';
  dtype: 'q4';
  progress_callback?: (progress: Record<string, unknown>) => void;
};

const loadTokenClassifier = pipeline as unknown as (
  task: 'token-classification',
  model: 'openai/privacy-filter',
  options: ClassifierOptions,
) => Promise<TokenClassifier>;

env.allowLocalModels = false;
env.useBrowserCache = true;

let classifierPromise: Promise<TokenClassifier> | undefined;
let runtime = 'webgpu/q4';

const post = (response: WorkerResponse) => self.postMessage(response);

const normalizeLabel = (label: string) => label.toUpperCase();

const replacementFor = (span: PrivacySpan, mode: RedactionMode) => {
  if (mode === 'block') {
    return '████';
  }

  return `[${normalizeLabel(span.entity_group)}]`;
};

const redactByOffsets = (text: string, spans: PrivacySpan[], mode: RedactionMode) => {
  const withOffsets = spans
    .filter((span): span is PrivacySpan & { start: number; end: number } =>
      Number.isInteger(span.start) && Number.isInteger(span.end) && span.start! < span.end!,
    )
    .sort((a, b) => b.start - a.start);

  return withOffsets.reduce(
    (output, span) => `${output.slice(0, span.start)}${replacementFor(span, mode)}${output.slice(span.end)}`,
    text,
  );
};

const redactByWords = (text: string, spans: PrivacySpan[], mode: RedactionMode) =>
  spans.reduce((output, span) => {
    const needle = span.word?.trim();
    if (!needle) {
      return output;
    }

    return output.replaceAll(needle, replacementFor(span, mode));
  }, text);

const getClassifier = async (id: string) => {
  if (!classifierPromise) {
    post({ id, type: 'progress', message: 'Downloader OpenAI Privacy Filter første gang …' });
    classifierPromise = loadTokenClassifier('token-classification', 'openai/privacy-filter', {
    classifierPromise = pipeline('token-classification', 'openai/privacy-filter', {
      device: 'webgpu',
      dtype: 'q4',
      progress_callback: (progress: Record<string, unknown>) => {
        const file = typeof progress.file === 'string' ? progress.file : 'model';
        const percentage = typeof progress.progress === 'number' ? progress.progress : undefined;
        post({ id, type: 'progress', message: `Henter ${file}`, progress: percentage });
      },
    });
    }) as Promise<TokenClassifier>;

    try {
      return await classifierPromise;
    } catch (error) {
      console.warn('WebGPU kunne ikke bruges, falder tilbage til WASM.', error);
      runtime = 'wasm/q4';
      post({ id, type: 'progress', message: 'WebGPU er ikke tilgængelig – bruger WASM i browseren.' });
      classifierPromise = loadTokenClassifier('token-classification', 'openai/privacy-filter', {
        device: 'wasm',
        dtype: 'q4',
      });
      classifierPromise = pipeline('token-classification', 'openai/privacy-filter', {
        device: 'wasm',
        dtype: 'q4',
      }) as Promise<TokenClassifier>;
    }
  }

  return classifierPromise;
};

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { id, text, mode } = event.data;

  try {
    const classifier = await getClassifier(id);
    post({ id, type: 'progress', message: 'Finder personoplysninger lokalt i browseren …' });
    const spans = await classifier(text, { aggregation_strategy: 'simple' });
    const redactedText = spans.some((span) => Number.isInteger(span.start) && Number.isInteger(span.end))
      ? redactByOffsets(text, spans, mode)
      : redactByWords(text, spans, mode);

    post({ id, type: 'result', redactedText, spans, runtime });
  } catch (error) {
    post({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : 'Ukendt fejl under lokal filtrering.',
    });
  }
});
