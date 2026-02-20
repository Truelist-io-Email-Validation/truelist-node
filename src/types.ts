export type TruelistOptions = {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
};

export type ValidateOptions = {
  signal?: AbortSignal;
};

export type ValidationState = "valid" | "invalid" | "risky" | "unknown";

export type ValidationSubState =
  | "ok"
  | "accept_all"
  | "disposable_address"
  | "role_address"
  | "failed_mx_check"
  | "failed_spam_trap"
  | "failed_no_mailbox"
  | "failed_greylisted"
  | "failed_syntax_check"
  | "unknown";

export type ValidationResult = {
  email: string;
  state: ValidationState;
  subState: ValidationSubState;
  freeEmail: boolean;
  role: boolean;
  disposable: boolean;
  suggestion: string | null;
};

export type AccountInfo = {
  email: string;
  plan: string;
  credits: number;
};

export type ApiValidationResponse = {
  email: string;
  state: ValidationState;
  sub_state: ValidationSubState;
  free_email: boolean;
  role: boolean;
  disposable: boolean;
  suggestion: string | null;
};

export type ApiAccountResponse = {
  email: string;
  plan: string;
  credits: number;
};
