export type PrivacyLabel =
  | 'private_person'
  | 'private_address'
  | 'private_email'
  | 'private_phone'
  | 'private_url'
  | 'private_date'
  | 'account_number'
  | 'secret';

export type PrivacySpan = {
  entity_group: PrivacyLabel | string;
  score?: number;
  word?: string;
  start?: number;
  end?: number;
};

export type RedactionMode = 'label' | 'block';

export type WorkerRequest = {
  id: string;
  text: string;
  mode: RedactionMode;
};

export type WorkerResponse =
  | {
      id: string;
      type: 'ready';
      runtime: string;
    }
  | {
      id: string;
      type: 'progress';
      message: string;
      progress?: number;
    }
  | {
      id: string;
      type: 'result';
      redactedText: string;
      spans: PrivacySpan[];
      runtime: string;
    }
  | {
      id: string;
      type: 'error';
      message: string;
    };
